# ProjectMapAI 🗺️⏱️

[![FastMCP 4.0](https://img.shields.io/badge/FastMCP-4.0.5-blue.svg)](https://github.com/jlowin/fastmcp)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-009688.svg)](https://fastapi.tiangolo.com)
[![Python 3.13](https://img.shields.io/badge/Python-3.13+-3776AB.svg)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Database-Filess.io%20(MySQL)-FF7800.svg)](https://filess.io/)
[![Hosted on Render](https://img.shields.io/badge/Render-Live%20Deployment-46E3B7.svg)](https://projectmap-ai.onrender.com/)

**ProjectMapAI** is a dual-interface timesheet and project tracking platform powered by **FastMCP 4.0** and **FastAPI**, backed by a cloud-hosted **Filess.io MySQL** persistence layer.

It exposes a unified database through two front doors:

1. 🌐 **Industrial Console Web Portal**: High-density operational dashboard for team members to log billable hours, inspect real-time project metrics, stream background tasks via Server-Sent Events (SSE), and request AI-powered weekly summaries.
2. 🤖 **FastMCP Server (`/mcp`)**: Streamable HTTP and stdio transport endpoints enabling AI assistants (Claude Desktop, Cursor, Goose, Prefect Horizon) to query projects, log time, trigger interactive human-in-the-loop confirmations, and generate structured reports.

---

## 🚀 Live Deployment

The application is deployed live on **Render** connected to **Filess.io**:

* **Web Console**: [https://projectmap-ai.onrender.com/](https://projectmap-ai.onrender.com/)
* **FastMCP Endpoint**: [https://projectmap-ai.onrender.com/mcp](https://projectmap-ai.onrender.com/mcp)
* **REST API Interactive Docs**: [https://projectmap-ai.onrender.com/docs](https://projectmap-ai.onrender.com/docs)
* **MCP Tools Registry**: [https://projectmap-ai.onrender.com/api/mcp/tools](https://projectmap-ai.onrender.com/api/mcp/tools)

---

## 🌟 Architecture Overview

```
                     ┌──────────────────────────────────────────────┐
                     │          Filess.io Cloud Database            │
                     │             (Managed MySQL 8.x)              │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │            database.py Persistence           │
                     │          (mysql-connector-python)            │
                     └──────────────────────┬───────────────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      │                                           │
            ┌─────────▼─────────┐                       ┌─────────▼─────────┐
            │   FastAPI Engine  │                       │    FastMCP 4.0    │
            │  (REST API + SSE) │                       │  (/mcp Endpoint)  │
            └─────────┬─────────┘                       └─────────┬─────────┘
                      │                                           │
       ┌──────────────┴──────────────┐             ┌──────────────┴──────────────┐
       │                             │             │                             │
┌──────▼──────┐               ┌──────▼──────┐┌─────▼──────┐               ┌──────▼──────┐
│ Web Console │               │ SSE Streams ││ Claude /   │               │ Prefect     │
│ (Industrial)│               │ (slow_tool) ││ Cursor IDE │               │ Horizon     │
└─────────────┘               └─────────────┘└────────────┘               └─────────────┘
```

### Why Filess.io for Cloud Database?

In **v3.0**, ProjectMapAI transitioned from a local single-file SQLite database to a cloud-hosted MySQL database on **[Filess.io](https://filess.io/)**:

* **Stateless Cloud Deployments**: Platforms like Render spin up ephemeral containers that discard local filesystem changes on restart. A cloud-hosted Filess.io instance ensures all timesheet records persist permanently without needing volume mounts.
* **Concurrent Multi-Client Access**: Supports concurrent read/write transactions across web users, AI background tasks, and MCP tool executions.
* **Zero Infrastructure Overhead**: Filess.io provides instant, managed MySQL instances with standard credentials (Host, User, Database, Port, Password).
* **Automatic Bootstrap & Diagnostics**: `database.py` validates connections on startup, auto-creates the schema (`time_entries`), and seeds initial sample records if the table is empty.

> 💡 **Offline Development Note:** If you ever need zero-configuration offline development without an internet connection, a standalone SQLite implementation is preserved in `database-local.py`.

---

## 🗄️ Database Schema & Configuration

### Schema Definition (`time_entries`)

```sql
CREATE TABLE IF NOT EXISTS time_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_name VARCHAR(255) NOT NULL,
    project VARCHAR(255) NOT NULL,
    entry_date DATE NOT NULL,
    hours DECIMAL(10,2) NOT NULL,
    description TEXT
);
```

### Auto-Seeding

On first startup against a clean Filess.io database, the system checks table record counts and automatically seeds starter records across projects (*Website Redesign*, *Client Onboarding*, *Internal Tools*) for testing.

---

## 🛠️ Protocol Capabilities & API Reference

### 1. FastMCP 4.0 Server Capabilities

| Type | Name | Description | Key Arguments / Returns |
| :--- | :--- | :--- | :--- |
| **Tool** | `log_time` | Log hours against a project. | `employee_name`, `project`, `entry_date` (`YYYY-MM-DD`), `hours`, `description` |
| **Tool** | `get_timesheet` | Retrieve logged entries for an employee. | `employee_name`, optional `start_date`, `end_date` |
| **Tool** | `get_project_summary`| Calculate aggregated hours per team member for a project. | `project` ➔ `{project, total_hours, by_employee}` |
| **Tool** | `list_projects` | Enumerate all unique projects with recorded entries. | None ➔ `list[str]` |
| **Tool** | `summarize_week` | AI narrative summary using Groq LLM (`openai/gpt-oss-20b`). | `employee_name`, `week_start` (`YYYY-MM-DD`) |
| **Tool** | `log_time_with_confirmation` | Interactive prompt via `ctx.elicit` if `hours > 10`. | Elicits human confirmation before inserting |
| **Tool** | `slow_tool` | Asynchronous 5-second task demoing `ctx.report_progress`. | Emits live progress steps (1 to 5) |
| **Resource** | `timesheet://projects` | Read-only MCP resource providing registered projects. | Returns JSON array of projects |
| **Prompt** | `generate_weekly_report` | Pre-configured prompt template for weekly summaries. | `employee_name`, `week_start` |

### 2. FastAPI REST & SSE Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Web application single page interface (`static/index.html`). |
| `GET` | `/api/entries` | List all recorded timesheet entries ordered chronologically. |
| `POST` | `/api/entries` | Record a time entry (flags high hours if confirmation required). |
| `POST` | `/api/entries/with-confirmation` | Record time with explicit confirmation check. |
| `GET` | `/api/projects` | List all unique projects with logged hours. |
| `GET` | `/api/projects/{project}/summary` | Get employee breakdown and total hours for a project. |
| `GET` | `/api/timesheet/{employee}` | Retrieve timesheet entries for an employee. |
| `POST` | `/api/summarize-week` | Request Groq AI weekly timesheet summary (`JSON payload`). |
| `GET` | `/api/timesheet/{employee}/summarize` | Shorthand query endpoint for weekly AI summary. |
| `GET` | `/api/slow-tool/stream` | Server-Sent Events (SSE) live progress stream (`text/event-stream`). |
| `POST` | `/api/slow-tool` | Asynchronous non-streaming demo endpoint. |
| `GET` | `/api/mcp/tools` | JSON registry describing all available MCP tools and parameters. |
| `ANY` | `/mcp` | FastMCP Streamable HTTP transport endpoint. |

---

## ⚡ Quick Start & Local Setup

### Prerequisites

* Python 3.13+
* [uv](https://docs.astral.sh/uv/) (recommended package manager) or standard `pip`
* A free MySQL database from [Filess.io](https://filess.io/)

### 1. Set Up Filess.io Cloud Database

1. Sign up or log into [Filess.io](https://filess.io/).
2. Create a new **MySQL** database instance.
3. Obtain your database connection details from the Filess.io dashboard:
   * **Host** (e.g., `xyz.filess.io`)
   * **Database Name** (e.g., `projectmapai_...`)
   * **Username** (e.g., `projectmapai_...`)
   * **Password**
   * **Port** (e.g., `3307` or `3306`)

### 2. Clone Repository & Install Dependencies

```bash
git clone https://github.com/jasongilchristp/projectmap-ai.git
cd projectmap-ai

# Synchronize virtual environment with uv
uv sync
```

### 3. Configure Environment Variables (`.env`)

Create a `.env` file in the root directory:

```env
# -----------------------------------------------------------
# Filess.io Cloud Database Configuration
# -----------------------------------------------------------
PROJECTMAPAI_DB_HOST=your-instance.filess.io
PROJECTMAPAI_DB_NAME=your_database_name
PROJECTMAPAI_DB_USER=your_database_user
PROJECTMAPAI_DB_PASSWORD=your_database_password
PROJECTMAPAI_DB_PORT=3307

# -----------------------------------------------------------
# Optional: Groq LLM API Key (for AI weekly summaries)
# -----------------------------------------------------------
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Inspect FastMCP Server

Validate your FastMCP installation and examine registered tools:

```bash
# Verify FastMCP CLI
uv run fastmcp version

# Inspect all tools, resources, and prompts
uv run fastmcp inspect main.py:mcp
```

### 5. Start the Server

```bash
# Start Uvicorn development server with auto-reload
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Once running:
* **Web Portal**: Visit [http://127.0.0.1:8000](http://127.0.0.1:8000)
* **MCP Endpoint**: Connect tools to [http://127.0.0.1:8000/mcp](http://127.0.0.1:8000/mcp)
* **API Documentation**: Browse [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🔌 Connecting AI Clients to ProjectMapAI

### Claude Desktop (`claude_desktop_config.json`)

#### Remote Connection (Render Deployment)
```json
{
  "mcpServers": {
    "projectmap-ai": {
      "url": "https://projectmap-ai.onrender.com/mcp"
    }
  }
}
```

#### Local Connection (via `uv` stdio)
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

Add ProjectMapAI to your project or global Cursor settings:

```json
{
  "mcpServers": {
    "projectmap-ai": {
      "url": "https://projectmap-ai.onrender.com/mcp"
    }
  }
}
```

### Prefect Horizon / Goose / Other MCP Hosts

Connect directly using the Streamable HTTP transport:
```text
https://projectmap-ai.onrender.com/mcp
```

Or test with the FastMCP CLI:
```bash
uv run fastmcp login
uv run fastmcp inspect main.py:mcp
```

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PROJECTMAPAI_DB_HOST` | `localhost` | Filess.io MySQL host (e.g., `xyz.filess.io`). |
| `PROJECTMAPAI_DB_NAME` | `projectmapai` | Filess.io MySQL database name. |
| `PROJECTMAPAI_DB_USER` | `root` | Filess.io MySQL user. |
| `PROJECTMAPAI_DB_PASSWORD`| `""` | Filess.io MySQL password. |
| `PROJECTMAPAI_DB_PORT` | `3306` | Filess.io MySQL port (converted to integer automatically). |
| `GROQ_API_KEY` | *(None)* | Optional. Used by `summarize_week` to generate natural language summaries with `openai/gpt-oss-20b`. |
| `PORT` | `8000` | Port for the Uvicorn web server (automatically configured by hosting platforms like Render). |

---

## 🚢 Cloud Deployment (Render + Filess.io)

Because ProjectMapAI uses **Filess.io** as its cloud database, deploying to Render or any container service is completely stateless and resilient:

1. **Connect Repository**: Link your GitHub repository (`jasongilchristp/projectmap-ai`) in [Render](https://render.com/).
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
   Add the following in your Render service dashboard under **Environment**:
   * `PROJECTMAPAI_DB_HOST` = `<your-filess-io-host>`
   * `PROJECTMAPAI_DB_NAME` = `<your-filess-io-db-name>`
   * `PROJECTMAPAI_DB_USER` = `<your-filess-io-user>`
   * `PROJECTMAPAI_DB_PASSWORD` = `<your-filess-io-password>`
   * `PROJECTMAPAI_DB_PORT` = `<your-filess-io-port>`
   * `GROQ_API_KEY` = `<your-groq-key>` (optional, for AI summaries)

---

## 📄 License

MIT License. Built with [FastMCP](https://github.com/jlowin/fastmcp), [FastAPI](https://fastapi.tiangolo.com/), [Filess.io](https://filess.io/), and Modern Industrial Web Design.
