"""
ProjectMapAI -- one running application, two front doors onto the same
SQLite database of logged time entries:

  1. A real website (served from ./static) -- for people, in a browser
  2. An MCP server, mounted at /mcp -- for AI assistants, over HTTP

Both talk to the exact same database.py functions.

Setup:
    uv init .
    uv add fastmcp fastapi "uvicorn[standard]" python-dotenv openai
    uv run uvicorn main:app --reload

Then visit http://127.0.0.1:8000 for the website,
and http://127.0.0.1:8000/mcp is the MCP endpoint (Streamable HTTP).
"""
import os
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from fastmcp import FastMCP, Context

import database as db

# Load environment variables (.env)
load_dotenv()

# ---------- persistence, initialized once at startup ----------
db.init_db()

# ---------- Step 1: build the MCP server FIRST ----------
# Hand-curated tools, calling the SAME database functions the REST API
# below uses -- nothing duplicated between the two front doors.
mcp = FastMCP("ProjectMapAI")

groq_api_key = os.environ.get("GROQ_API_KEY")
groq_client = None
if groq_api_key:
    groq_client = OpenAI(
        api_key=groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )


# ============================================================
# SHARED CORE LOGIC FOR AI / TOOLS
# ============================================================

def generate_week_summary(employee_name: str, week_start: str) -> dict:
    """Generate an AI summary for one employee's week of logged work."""
    entries = db.get_timesheet(employee_name, start_date=week_start)
    if not entries:
        return {
            "status": "empty",
            "employee_name": employee_name,
            "week_start": week_start,
            "entries_count": 0,
            "total_hours": 0.0,
            "summary": f"No entries found for {employee_name} starting {week_start}.",
            "model": "openai/gpt-oss-20b",
        }

    total_hours = sum(e["hours"] for e in entries)
    entries_text = "\n".join(
        f"- {e['project']}: {e['hours']}h ({e['description']})" for e in entries
    )

    if not groq_client:
        return {
            "status": "error",
            "employee_name": employee_name,
            "week_start": week_start,
            "entries_count": len(entries),
            "total_hours": total_hours,
            "summary": "GROQ_API_KEY is not configured on the server. Please add it to your .env file.",
            "model": "openai/gpt-oss-20b",
        }

    try:
        response = groq_client.responses.create(
            model="openai/gpt-oss-20b",
            input=f"Summarize this week's work for {employee_name} in two friendly sentences:\n\n{entries_text}",
        )
        text = ""
        if hasattr(response, "output_text") and response.output_text:
            text = str(response.output_text).strip()
        elif hasattr(response, "output") and response.output:
            text = str(response.output).strip()

        return {
            "status": "success",
            "employee_name": employee_name,
            "week_start": week_start,
            "entries_count": len(entries),
            "total_hours": total_hours,
            "summary": text or "Could not generate a summary.",
            "model": "openai/gpt-oss-20b",
        }
    except Exception as err:
        return {
            "status": "error",
            "employee_name": employee_name,
            "week_start": week_start,
            "entries_count": len(entries),
            "total_hours": total_hours,
            "summary": f"AI service error: {str(err)}",
            "model": "openai/gpt-oss-20b",
        }


# ============================================================
# MCP TOOLS
# ============================================================

@mcp.tool
def log_time(employee_name: str, project: str, entry_date: str, hours: float, description: str = "") -> dict:
    """Log a time entry. entry_date must be YYYY-MM-DD."""
    return db.log_time(employee_name, project, entry_date, hours, description)


@mcp.tool
def get_timesheet(employee_name: str, start_date: str = "", end_date: str = "") -> list[dict]:
    """Get one employee's logged entries, optionally filtered to a date range (YYYY-MM-DD)."""
    return db.get_timesheet(employee_name, start_date or None, end_date or None)


@mcp.tool
def get_project_summary(project: str) -> dict:
    """Get total hours logged against a project, broken down by employee."""
    return db.get_project_summary(project)


@mcp.tool
def list_projects() -> list[str]:
    """List every project that has at least one logged time entry."""
    return db.list_projects()


@mcp.resource("timesheet://projects")
def known_projects() -> list[str]:
    """The current set of projects with logged time."""
    return db.list_projects()


@mcp.prompt
def generate_weekly_report(employee_name: str, week_start: str) -> str:
    """Guides the AI to build a structured weekly hours report."""
    return f"""Build a weekly report for {employee_name}, starting {week_start}.

1. Call get_timesheet with employee_name='{employee_name}', start_date='{week_start}'
2. Group the results by project
3. Present it as a clean report with a total

If no entries are found for that week, say so plainly instead of inventing data.
"""


@mcp.tool
async def summarize_week(employee_name: str, week_start: str) -> str:
    """Summarize one employee's week in plain language, using an LLM."""
    res = generate_week_summary(employee_name, week_start)
    return res["summary"]


@mcp.tool
async def log_time_with_confirmation(
    employee_name: str, project: str, entry_date: str, hours: float, description: str, ctx: Context
) -> dict:
    """Log time, but pause to confirm first if the hours look unusually high."""
    if hours > 10:
        result = await ctx.elicit(
            f"{hours} hours in one day is unusually high -- log it anyway?",
            response_type=bool,
        )
        if result.action != "accept" or not result.data:
            return {"status": "cancelled", "reason": "not confirmed by user"}
    return db.log_time(employee_name, project, entry_date, hours, description)


@mcp.tool
async def slow_tool(ctx: Context) -> str:
    """Takes about 5 seconds on purpose, reporting progress the whole way -- for demoing timeouts and progress."""
    total_steps = 5
    for step in range(1, total_steps + 1):
        await asyncio.sleep(1)
        await ctx.report_progress(progress=step, total=total_steps, message=f"Step {step} of {total_steps}")
    return "Finished all 5 steps."


mcp_app = mcp.http_app(path="/")


# ---------- Step 2: build the FastAPI app, lifespan wired in AT CONSTRUCTION ----------
app = FastAPI(title="ProjectMapAI", lifespan=mcp_app.lifespan)


class NewEntry(BaseModel):
    employee_name: str
    project: str
    entry_date: str
    hours: float
    description: str = ""
    confirmed: Optional[bool] = None


class SummarizeWeekRequest(BaseModel):
    employee_name: str
    week_start: str


class LogConfirmationRequest(BaseModel):
    employee_name: str
    project: str
    entry_date: str
    hours: float
    description: str = ""
    confirmed: Optional[bool] = None


@app.get("/api/entries")
def api_list_entries():
    return db.list_all_entries()


@app.post("/api/entries")
def api_log_entry(entry: NewEntry):
    if entry.hours <= 0:
        raise HTTPException(status_code=400, detail="hours must be a positive number")
    if entry.hours > 10 and entry.confirmed is not True:
        return {
            "status": "confirmation_required",
            "requires_confirmation": True,
            "message": f"{entry.hours} hours in one day is unusually high -- log it anyway?",
            "employee_name": entry.employee_name,
            "project": entry.project,
            "entry_date": entry.entry_date,
            "hours": entry.hours,
            "description": entry.description,
        }
    logged = db.log_time(entry.employee_name, entry.project, entry.entry_date, entry.hours, entry.description)
    return {"status": "logged", "entry": logged}


@app.post("/api/entries/with-confirmation")
def api_log_entry_with_confirmation(entry: LogConfirmationRequest):
    if entry.hours <= 0:
        raise HTTPException(status_code=400, detail="hours must be a positive number")
    if entry.hours > 10:
        if entry.confirmed is False:
            return {"status": "cancelled", "reason": "not confirmed by user"}
        if entry.confirmed is not True:
            return {
                "status": "confirmation_required",
                "requires_confirmation": True,
                "message": f"{entry.hours} hours in one day is unusually high -- log it anyway?",
                "employee_name": entry.employee_name,
                "project": entry.project,
                "entry_date": entry.entry_date,
                "hours": entry.hours,
                "description": entry.description,
            }
    logged = db.log_time(entry.employee_name, entry.project, entry.entry_date, entry.hours, entry.description)
    return {"status": "logged", "entry": logged}


@app.get("/api/projects")
def api_list_projects():
    return db.list_projects()


@app.get("/api/projects/{project}/summary")
def api_project_summary(project: str):
    return db.get_project_summary(project)


@app.get("/api/timesheet/{employee_name}")
def api_get_timesheet(employee_name: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    return db.get_timesheet(employee_name, start_date, end_date)


@app.post("/api/summarize-week")
def api_summarize_week(req: SummarizeWeekRequest):
    """FastAPI endpoint to summarize one employee's week using LLM."""
    return generate_week_summary(req.employee_name, req.week_start)


@app.get("/api/timesheet/{employee_name}/summarize")
def api_timesheet_summarize(
    employee_name: str,
    week_start: str = Query(..., description="Start date of the week in YYYY-MM-DD"),
):
    """FastAPI GET endpoint to summarize an employee's week."""
    return generate_week_summary(employee_name, week_start)


@app.get("/api/slow-tool/stream")
async def api_slow_tool_stream():
    """Server-Sent Events (SSE) streaming progress for slow_tool."""
    async def event_generator():
        total_steps = 5
        for step in range(1, total_steps + 1):
            await asyncio.sleep(1)
            progress = int((step / total_steps) * 100)
            is_done = (step == total_steps)
            payload = {
                "step": step,
                "total": total_steps,
                "progress": progress,
                "message": f"Step {step} of {total_steps}" if not is_done else "Finished all 5 steps.",
                "done": is_done,
                "result": "Finished all 5 steps." if is_done else None,
            }
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/slow-tool")
async def api_slow_tool_sync():
    """Non-streaming endpoint for slow_tool."""
    for _ in range(5):
        await asyncio.sleep(1)
    return {"status": "completed", "result": "Finished all 5 steps."}


@app.get("/api/mcp/tools")
def api_mcp_tools():
    """List all registered MCP tools and their descriptions."""
    return {
        "server_name": "ProjectMapAI",
        "mcp_endpoint": "/mcp",
        "tools": [
            {
                "name": "log_time",
                "description": "Log a time entry. entry_date must be YYYY-MM-DD.",
                "parameters": ["employee_name", "project", "entry_date", "hours", "description"],
                "category": "core",
            },
            {
                "name": "get_timesheet",
                "description": "Get one employee's logged entries, optionally filtered to a date range.",
                "parameters": ["employee_name", "start_date", "end_date"],
                "category": "core",
            },
            {
                "name": "get_project_summary",
                "description": "Get total hours logged against a project, broken down by employee.",
                "parameters": ["project"],
                "category": "analytics",
            },
            {
                "name": "list_projects",
                "description": "List every project that has at least one logged time entry.",
                "parameters": [],
                "category": "core",
            },
            {
                "name": "summarize_week",
                "description": "Summarize one employee's week in plain language, using an LLM (Groq openai/gpt-oss-20b).",
                "parameters": ["employee_name", "week_start"],
                "category": "ai",
            },
            {
                "name": "log_time_with_confirmation",
                "description": "Log time, but pause to confirm with ctx.elicit first if the hours look unusually high (> 10h).",
                "parameters": ["employee_name", "project", "entry_date", "hours", "description"],
                "category": "interactive",
            },
            {
                "name": "slow_tool",
                "description": "Takes about 5 seconds on purpose, reporting progress the whole way -- for demoing timeouts and progress.",
                "parameters": [],
                "category": "demo",
            },
        ],
    }


@app.get("/")
def serve_index():
    return FileResponse("static/index.html")


app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/mcp", mcp_app)
