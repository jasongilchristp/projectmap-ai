"""
ProjectMapAI's persistence layer -- MySQL, shared by the website and the MCP
server.
time: logging billable hours against projects, and summarizing them.
"""

import os
import mysql.connector
from mysql.connector import Error

from dotenv import load_dotenv

load_dotenv()

HOSTNAME = os.environ.get("PROJECTMAPAI_DB_HOST", "localhost")
DATABASE = os.environ.get("PROJECTMAPAI_DB_NAME", "projectmapai")
USERNAME = os.environ.get("PROJECTMAPAI_DB_USER", "root")
PASSWORD = os.environ.get("PROJECTMAPAI_DB_PASSWORD", "")
PORT = os.environ.get("PROJECTMAPAI_DB_PORT", "3306")

def get_connection():
    try:
        return mysql.connector.connect(
            host=HOSTNAME,
            database=DATABASE,
            user=USERNAME,
            password=PASSWORD,
            port=int(PORT)  # FIX: Explicitly convert port to an integer
        )
    except Error as e:
        # This will print the EXACT reason it is failing to your Python terminal
        print("\n" + "="*50)
        print(f"CRITICAL DATABASE ERROR: {e}")
        print("="*50)
        print("Are these the correct credentials being loaded?")
        print(f"Host: {HOSTNAME}")
        print(f"User: {USERNAME}")
        print(f"Database: {DATABASE}")
        print(f"Port: {PORT}")
        print("="*50 + "\n")
        raise


def init_db():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS time_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_name VARCHAR(255) NOT NULL,
                project VARCHAR(255) NOT NULL,
                entry_date DATE NOT NULL,
                hours DECIMAL(10,2) NOT NULL,
                description TEXT
            )
        """)
        cursor.execute("SELECT COUNT(*) FROM time_entries")
        count = cursor.fetchone()[0]
        
        if count == 0:
            seed = [
                ("Jason Gilchrist", "Website Redesign", "2026-09-08", 6.5, "Homepage layout"),
                ("Jason Gilchrist", "Website Redesign", "2026-09-09", 7.0, "Mobile responsive fixes"),
                ("Jason Gilchrist", "Client Onboarding", "2026-09-10", 3.0, "Kickoff call + notes"),
                ("Sharuk Khan", "Website Redesign", "2026-09-08", 5.5, "API integration"),
                ("Sharuk Khan", "Internal Tools", "2026-09-09", 8.0, "Dashboard bug fixes"),
            ]
            cursor.executemany(
                "INSERT INTO time_entries (employee_name, project, entry_date, hours, description) "
                "VALUES (%s, %s, %s, %s, %s)",
                seed,
            )
            conn.commit()
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


def _row_to_dict(row) -> dict:
    if not row:
        return None
    return {
        "id": row["id"],
        "employee_name": row["employee_name"],
        "project": row["project"],
        "entry_date": str(row["entry_date"]),  # Cast Date object to string
        "hours": float(row["hours"]),          # Cast Decimal object to float
        "description": row["description"] or "",
    }


def list_all_entries() -> list[dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM time_entries ORDER BY entry_date DESC, id DESC")
        rows = cursor.fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


def log_time(employee_name: str, project: str, entry_date: str, hours: float, description: str = "") -> dict:
    if hours <= 0:
        raise ValueError("hours must be a positive number")
        
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO time_entries (employee_name, project, entry_date, hours, description) "
            "VALUES (%s, %s, %s, %s, %s)",
            (employee_name, project, entry_date, hours, description),
        )
        conn.commit()
        new_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM time_entries WHERE id = %s", (new_id,))
        row = cursor.fetchone()
        return _row_to_dict(row)
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


def get_timesheet(employee_name: str, start_date: str | None = None, end_date: str | None = None) -> list[dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM time_entries WHERE employee_name = %s"
        params: list = [employee_name]
        
        if start_date:
            query += " AND entry_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND entry_date <= %s"
            params.append(end_date)
            
        query += " ORDER BY entry_date"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


def execute_query(query: str, params: list = []) -> list[dict]:
    # Note: If passing queries directly into this function from elsewhere,
    # ensure they use '%s' for placeholders instead of SQLite's '?'.
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


def list_projects() -> list[str]:
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT DISTINCT project FROM time_entries ORDER BY project")
        rows = cursor.fetchall()
        return [r["project"] for r in rows]
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


def get_project_summary(project: str) -> dict:
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT employee_name, SUM(hours) as total_hours FROM time_entries "
            "WHERE project = %s GROUP BY employee_name ORDER BY employee_name",
            (project,),
        )
        rows = cursor.fetchall()
        
        if not rows:
            raise ValueError(f"No time logged against project '{project}'")
            
        # Float cast is necessary here because MySQL's SUM() returns a Decimal type
        by_employee = {r["employee_name"]: float(r["total_hours"]) for r in rows}
        
        return {
            "project": project,
            "total_hours": sum(by_employee.values()),
            "by_employee": by_employee,
        }
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()