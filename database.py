"""
ProjectMapAI's persistence layer -- SQLite, shared by the website and the MCP
server.
time: logging billable hours against projects, and summarizing them.
"""

import os
import shutil
import sqlite3
import stat
import tempfile
from pathlib import Path


def _is_path_writable(path: Path) -> bool:
    """Test whether a SQLite database file and its parent directory can be written to."""
    try:
        parent = path.parent
        if not parent.exists():
            parent.mkdir(parents=True, exist_ok=True)

        # Check directory writability (needed for SQLite rollback journal & lock creation)
        test_file = parent / f".write_test_{os.getpid()}"
        with open(test_file, "a") as f:
            pass
        test_file.unlink(missing_ok=True)

        # If database file already exists, check file writability
        if path.exists():
            if not os.access(path, os.W_OK):
                return False
            with open(path, "a") as f:
                pass
        return True
    except (OSError, PermissionError):
        return False


def get_db_path() -> Path:
    """
    Determine the SQLite database path.
    1. Check for explicit environment variables: PROJECTMAP_DB_PATH or DATABASE_PATH.
    2. Check if the local project directory is writable.
    3. In read-only filesystems (e.g. Prefect Horizon deployments, Docker read-only, AWS Lambda),
       automatically fallback to a writable temporary directory (/tmp/projectmapai.db).
    """
    env_path = os.environ.get("PROJECTMAP_DB_PATH") or os.environ.get("DATABASE_PATH")
    if env_path:
        target = Path(env_path)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        return target

    local_path = Path(__file__).parent / "projectmapai.db"
    if _is_path_writable(local_path):
        return local_path

    # Read-only environment detected (e.g. Prefect Horizon / container checkout)
    temp_dir = Path(tempfile.gettempdir())
    temp_path = temp_dir / "projectmapai.db"

    # If an existing local DB exists, copy it to temp_path so existing data isn't lost
    if local_path.exists() and not temp_path.exists():
        try:
            shutil.copy2(local_path, temp_path)
            try:
                os.chmod(temp_path, stat.S_IWRITE | stat.S_IREAD)
            except Exception:
                pass
        except Exception:
            pass

    return temp_path


DB_PATH = get_db_path()


def _migrate_to_temp_if_readonly():
    """Migrate the database to a writable temporary directory if read-only filesystem error is encountered."""
    global DB_PATH
    temp_path = Path(tempfile.gettempdir()) / "projectmapai.db"
    old_path = DB_PATH
    if old_path != temp_path and old_path.exists():
        try:
            shutil.copy2(old_path, temp_path)
            try:
                os.chmod(temp_path, stat.S_IWRITE | stat.S_IREAD)
            except Exception:
                pass
        except Exception:
            pass
    DB_PATH = temp_path
    os.environ["PROJECTMAP_DB_PATH"] = str(temp_path)
    _do_init_db()


def get_connection():
    global DB_PATH
    DB_PATH = get_db_path()
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA busy_timeout = 15000")
        conn.execute("PRAGMA foreign_keys = ON")
    except Exception:
        pass
    return conn


def _do_init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_name TEXT NOT NULL,
            project TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            hours REAL NOT NULL,
            description TEXT NOT NULL DEFAULT ''
        )
    """)
    count = conn.execute("SELECT COUNT(*) FROM time_entries").fetchone()[0]
    if count == 0:
        seed = [
            ("Jason Gilchrist", "Website Redesign", "2026-09-08", 6.5, "Homepage layout"),
            ("Jason Gilchrist", "Website Redesign", "2026-09-09", 7.0, "Mobile responsive fixes"),
            ("Jason Gilchrist", "Client Onboarding", "2026-09-10", 3.0, "Kickoff call + notes"),
            ("Sharuk Khan", "Website Redesign", "2026-09-08", 5.5, "API integration"),
            ("Sharuk Khan", "Internal Tools", "2026-09-09", 8.0, "Dashboard bug fixes"),
        ]
        conn.executemany(
            "INSERT INTO time_entries (employee_name, project, entry_date, hours, description) "
            "VALUES (?, ?, ?, ?, ?)",
            seed,
        )
        conn.commit()
    conn.close()


def init_db():
    try:
        _do_init_db()
    except sqlite3.OperationalError as e:
        if "readonly database" in str(e).lower():
            _migrate_to_temp_if_readonly()
        else:
            raise


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "employee_name": row["employee_name"],
        "project": row["project"],
        "entry_date": row["entry_date"],
        "hours": row["hours"],
        "description": row["description"],
    }


def list_all_entries() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM time_entries ORDER BY entry_date DESC, id DESC").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def _do_log_time(employee_name: str, project: str, entry_date: str, hours: float, description: str = "") -> dict:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO time_entries (employee_name, project, entry_date, hours, description) "
        "VALUES (?, ?, ?, ?, ?)",
        (employee_name, project, entry_date, hours, description),
    )
    conn.commit()
    new_id = cursor.lastrowid
    row = conn.execute("SELECT * FROM time_entries WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return _row_to_dict(row)


def log_time(employee_name: str, project: str, entry_date: str, hours: float, description: str = "") -> dict:
    if hours <= 0:
        raise ValueError("hours must be a positive number")
    try:
        return _do_log_time(employee_name, project, entry_date, hours, description)
    except sqlite3.OperationalError as e:
        if "readonly database" in str(e).lower():
            _migrate_to_temp_if_readonly()
            return _do_log_time(employee_name, project, entry_date, hours, description)
        raise


def get_timesheet(employee_name: str, start_date: str | None = None, end_date: str | None = None) -> list[dict]:
    conn = get_connection()
    query = "SELECT * FROM time_entries WHERE employee_name = ?"
    params: list = [employee_name]
    if start_date:
        query += " AND entry_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND entry_date <= ?"
        params.append(end_date)
    query += " ORDER BY entry_date"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def execute_query(query: str, params: list | tuple | None = None) -> list[dict]:
    if params is None:
        params = []
    try:
        conn = get_connection()
        rows = conn.execute(query, params).fetchall()
        conn.commit()
        conn.close()
        return [_row_to_dict(r) for r in rows]
    except sqlite3.OperationalError as e:
        if "readonly database" in str(e).lower():
            _migrate_to_temp_if_readonly()
            conn = get_connection()
            rows = conn.execute(query, params).fetchall()
            conn.commit()
            conn.close()
            return [_row_to_dict(r) for r in rows]
        raise


def list_projects() -> list[str]:
    conn = get_connection()
    rows = conn.execute("SELECT DISTINCT project FROM time_entries ORDER BY project").fetchall()
    conn.close()
    return [r["project"] for r in rows]


def get_project_summary(project: str) -> dict:
    conn = get_connection()
    rows = conn.execute(
        "SELECT employee_name, SUM(hours) as total_hours FROM time_entries "
        "WHERE project = ? GROUP BY employee_name ORDER BY employee_name",
        (project,),
    ).fetchall()
    conn.close()
    if not rows:
        raise ValueError(f"No time logged against project '{project}'")
    by_employee = {r["employee_name"]: r["total_hours"] for r in rows}
    return {
        "project": project,
        "total_hours": sum(by_employee.values()),
        "by_employee": by_employee,
    }
    