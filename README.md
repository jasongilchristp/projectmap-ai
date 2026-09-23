# ProjectMapAI 🗺️⏱️

[![FastMCP 4.0](https://img.shields.io/badge/FastMCP-4.0.5-blue.svg)](https://github.com/jlowin/fastmcp)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-009688.svg)](https://fastapi.tiangolo.com)
[![Python 3.13](https://img.shields.io/badge/Python-3.13+-3776AB.svg)](https://www.python.org/)
[![Hosted on Render](https://img.shields.io/badge/Render-Live%20Deployment-46E3B7.svg)](https://projectmap-ai.onrender.com/)

**ProjectMapAI** is a dual-interface timesheet platform and Model Context Protocol (MCP) server. It exposes a single SQLite persistence layer through two front doors:

1. 🌐 **Industrial Console Web Portal**: High-density operational dashboard for team members to log billable hours, inspect real-time project metrics, stream background jobs, and view AI timesheet summaries.
2. 🤖 **FastMCP Server (`/mcp`)**: Streamable HTTP and stdio endpoints allowing AI assistants (Claude, Cursor, Goose, Horizon) to query projects, log time, elicit interactive human confirmations, and generate LLM reports.

---

## 🚀 Live Deployment

The application is deployed live on **Render**:

* **Web Console**: [https://projectmap-ai.onrender.com/](https://projectmap-ai.onrender.com/)
* **FastMCP Endpoint**: [https://projectmap-ai.onrender.com/mcp](https://projectmap-ai.onrender.com/mcp)
* **REST API Schema**: [https://projectmap-ai.onrender.com/docs](https://projectmap-ai.onrender.com/docs)
* **MCP Tools Registry**: [https://projectmap-ai.onrender.com/api/mcp/tools](https://projectmap-ai.onrender.com/api/mcp/tools)

---

## 🌟 Key Architecture & Capabilities

```
                       ┌─────────────────────────────────────────┐
                       │           SQLite Persistence            │
                       │          (database.py / .db)            │
                       └────────────────────┬────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     │                                             │
           ┌─────────▼─────────┐                         ┌─────────▼─────────┐
           │   FastAPI Portal  │                         │    FastMCP 4.0    │
           │  (REST API + SSE) │                         │  (/mcp Endpoint)  │
           └─────────┬─────────┘                         └─────────┬─────────┘
                     │                                             │
      ┌──────────────┴──────────────┐               ┌──────────────┴──────────────┐
      │                             │               │                             │
┌─────▼──────┐               ┌──────▼──────┐  ┌─────▼──────┐               ┌──────▼──────┐
│ Web Client │               │ SSE Streams │  │ Claude /   │               │ Prefect     │
│ (VanillaJS)│               │ (slow_tool) │  │ Cursor     │               │ Horizon     │
└────────────┘               └─────────────┘  └────────────┘               └─────────────┘
```

### 1. FastMCP 4.0 Protocol Capabilities

| Type | Name | Description | Key Arguments / Returns |
| :--- | :--- | :--- | :--- |
| **Tool** | `log_time` | Log hours against a project. | `employee_name`, `project`, `entry_date` (`YYYY-MM-DD`), `hours`, `description` |
| **Tool** | `get_timesheet` | Retrieve logged entries for an employee. | `employee_name`, optional `start_date`, `end_date` |
| **Tool** | `get_project_summary`| Calculate aggregated hours per team member. | `project` ➔ `{project, total_hours, by_employee}` |
| **Tool** | `list_projects` | Enumerate all projects with recorded entries. | None ➔ `list[str]` |
| **Tool** | `summarize_week` | AI narrative summary using Groq LLM (`gpt-oss-20b`). | `employee_name`, `week_start` (`YYYY-MM-DD`) |
| **Tool** | `log_time_with_confirmation` | Interactive prompt (`ctx.elicit`) if `hours > 10`. | Logs entry upon user confirmation |
| **Tool** | `slow_tool` | Asynchronous 5-second task demoing `ctx.report_progress`. | Emits live progress steps (1 to 5) |
| **Resource** | `timesheet://projects` | Read-only MCP resource of active projects. | Returns JSON array of projects |
| **Prompt** | `generate_weekly_report` | Pre-configured prompt template for weekly summaries. | `employee_name`, `week_start` |

### 2. FastAPI REST & SSE Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Web application single page interface (`static/index.html`). |
| `GET` | `/api/entries` | List all recorded timesheet entries ordered chronologically. |
| `POST` | `/api/entries` | Record a time entry (flags high hours if confirmation required). |
| `POST` | `/api/entries/with-confirmation` | Record time with explicit confirmation check. |
| `GET` | `/api/projects` | List all unique projects. |
| `GET` | `/api/projects/{project}/summary` | Get employee breakdown and total hours for a project. |
| `GET` | `/api/timesheet/{employee}` | Retrieve timesheet entries for an employee. |
| `POST` | `/api/summarize-week` | Request Groq AI weekly timesheet summary (`JSON payload`). |
| `GET` | `/api/timesheet/{employee}/summarize` | Shorthand query endpoint for weekly AI summary. |
| `GET` | `/api/slow-tool/stream` | Server-Sent Events (SSE) live progress stream (`text/event-stream`). |
| `POST` | `/api/slow-tool` | Asynchronous non-streaming demo endpoint. |
| `GET` | `/api/mcp/tools` | JSON registry describing all available MCP tools and parameters. |
| `ANY` | `/mcp` | FastMCP Streamable HTTP transport endpoint. |

---

## 🔌 Connecting AI Clients to ProjectMapAI

### Claude Desktop (`claude_desktop_config.json`)

To connect Claude Desktop directly to the remote hosted instance on Render:

```json
{
  "mcpServers": {
    "projectmap-ai": {
      "url": "https://projectmap-ai.onrender.com/mcp"
    }
  }
}
```

Or run via local `uv` stdio:

```json
{
  "mcpServers": {
    "projectmap-ai": {
      "command": "uv",
      "args": ["run", "fastmcp", "run", "main.py:mcp"],
      "cwd": "/path/to/projectmap-ai"
    }
  }
}
```

### Cursor IDE (`.cursor/mcp.json`)

Add ProjectMapAI to your Cursor workspace settings:

```json
{
  "mcpServers": {
    "projectmap-ai": {
      "url": "https://projectmap-ai.onrender.com/mcp"
    }
  }
}
```

### Prefect Horizon

To connect to or test with Prefect Horizon:

```bash
uv run fastmcp login
uv run fastmcp inspect main.py:mcp
```

Or connect Horizon directly to the live URL:
`https://projectmap-ai.onrender.com/mcp`

---

## 🛠️ Local Development & Setup

### Prerequisites

* Python 3.13+
* [uv](https://docs.astral.sh/uv/) (recommended) or standard `pip`

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/jasongilchristp/projectmap-ai.git
cd projectmap-ai

# Synchronize virtual environment with uv
uv sync
```

### 2. Configure Environment (.env)

Create a `.env` file in the repository root:

```env
# Optional: Set custom database path (defaults to projectmapai.db)
# In container/read-only environments (e.g. Render /tmp or Horizon), set:
PROJECTMAPAI_DB_PATH=projectmapai.db

# Optional: Groq API Key for AI weekly summaries (gpt-oss-20b)
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Verify FastMCP Server

```bash
# Verify FastMCP version and environment
uv run fastmcp version

# Inspect the server tools, prompts, and resources
uv run fastmcp inspect main.py:mcp
```

### 4. Run the Application

```bash
# Start Uvicorn development server
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.

---

## ⚙️ Environment Variables Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PROJECTMAPAI_DB_PATH` | `projectmapai.db` | Custom file path for the SQLite database. Useful for persistent disks on Render (e.g. `/var/data/projectmapai.db`) or writable directories like `/tmp/projectmapai.db` in serverless/container environments. |
| `GROQ_API_KEY` | *(None)* | Required for `summarize_week` AI narrative generation using `openai/gpt-oss-20b` via Groq. |
| `PORT` | `8000` | Port for Uvicorn server (automatically populated by Render). |

---

## 🚢 Deployment Guide

### Deploying on Render

ProjectMapAI is optimized for zero-configuration deployment on Render as a Web Service:

1. **Repository**: Connect your GitHub repository (`jasongilchristp/projectmap-ai`).
2. **Environment**: Python 3.
3. **Build Command**:
   ```bash
   pip install uv && uv sync
   ```
4. **Start Command**:
   ```bash
   uv run uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. **Environment Variables**:
   * Add `GROQ_API_KEY` with your Groq API key.
   * Add `PROJECTMAPAI_DB_PATH=/tmp/projectmapai.db` or mount a Render Persistent Disk for persistent records.

---

## 📄 License

MIT License. Designed and built with FastMCP, FastAPI, and Modern Industrial Web Design.
