# ProjectMapAI

ProjectMapAI is an intelligent timesheet MCP server and web platform for logging billable hours, querying entries, generating AI weekly summaries, and running interactive AI assistant workflows. It is powered by FastMCP 4.0, FastAPI, and SQLite.

## MCP Capabilities

| Type | Name | Purpose |
| --- | --- | --- |
| Tool | `log_time` | Add a time entry (`YYYY-MM-DD`). |
| Tool | `get_timesheet` | Get an employee's entries, optionally within a date range. |
| Tool | `get_project_summary` | Aggregate hours by project and employee. |
| Tool | `list_projects` | List projects with recorded entries. |
| Tool | `summarize_week` | Summarize an employee's weekly logged work in plain language using an LLM (Groq `openai/gpt-oss-20b`). |
| Tool | `log_time_with_confirmation` | Log time with interactive `ctx.elicit` interruption if daily hours exceed 10 hours. |
| Tool | `slow_tool` | 5-second asynchronous task demonstrating `ctx.report_progress` progress reporting and timeout handling. |
| Resource | `timesheet://projects` | Read known project names. |
| Prompt | `generate_weekly_report` | Structure a request for a weekly hours report. |

## FastAPI REST & SSE Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Web portal user interface (`static/index.html`). |
| `GET` | `/api/entries` | List all logged time records. |
| `POST` | `/api/entries` | Record a time entry (supports high-hours confirmation guard). |
| `POST` | `/api/entries/with-confirmation` | Record time with explicit confirmation check for `hours > 10`. |
| `GET` | `/api/projects` | List active projects. |
| `GET` | `/api/projects/{project}/summary` | Get aggregated project breakdown by team member. |
| `GET` | `/api/timesheet/{employee}` | Query employee entries filtered by optional `start_date` and `end_date`. |
| `POST` | `/api/summarize-week` | Generate LLM weekly summary (`employee_name`, `week_start`). |
| `GET` | `/api/timesheet/{employee}/summarize` | GET shorthand for weekly summary (`?week_start=YYYY-MM-DD`). |
| `GET` | `/api/slow-tool/stream` | Server-Sent Events (SSE) live progress stream (`text/event-stream`). |
| `POST` | `/api/slow-tool` | Synchronous/async execution of 5-second task. |
| `GET` | `/api/mcp/tools` | JSON registry of all MCP tools and metadata. |
| `ANY` | `/mcp` | FastMCP streamable HTTP endpoint for AI assistants. |

## Run locally

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then from the repository root:

```bash
uv sync
uv run fastmcp version
uv run fastmcp inspect main.py:mcp
uv run uvicorn main:app --reload
```

- Web Portal: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- MCP Streamable HTTP: [http://127.0.0.1:8000/mcp](http://127.0.0.1:8000/mcp)
