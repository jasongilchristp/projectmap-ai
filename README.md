# ProjectMapAI

ProjectMapAI is a timesheet MCP server for logging billable hours and querying entries and project totals through an AI assistant. It uses FastMCP and SQLite.

## MCP capabilities

| Type | Name | Purpose |
| --- | --- | --- |
| Tool | `log_time` | Add a time entry. |
| Tool | `get_timesheet` | Get an employee's entries, optionally within a date range. |
| Tool | `get_project_summary` | Aggregate hours by project and employee. |
| Tool | `list_projects` | List projects with recorded entries. |
| Resource | `timesheet://projects` | Read known project names. |
| Prompt | `generate_weekly_report` | Structure a request for a weekly hours report. |


## Run locally

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then from the repository root:

```bash
uv sync
uv run fastmcp version
uv run fastmcp inspect main.py:mcp
uv run uvicorn main:app --reload
```
