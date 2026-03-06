import sqlite3
from datetime import datetime, timezone


def init_db(db_path: str) -> sqlite3.Connection:
    """Create and return a sqlite3 connection with the schema set up."""
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    _create_schema(conn)
    return conn


def _create_schema(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS auth (
            id        INTEGER PRIMARY KEY,
            salt      TEXT NOT NULL,
            key_check TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entries (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            title      TEXT NOT NULL,
            blob       TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            word_count INTEGER DEFAULT 0
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
            entry_id UNINDEXED,
            title,
            body
        );
    """)
    conn.commit()


def is_setup(conn: sqlite3.Connection) -> bool:
    row = conn.execute("SELECT 1 FROM auth LIMIT 1").fetchone()
    return row is not None


def save_auth(conn: sqlite3.Connection, salt: str, key_check: str):
    conn.execute("DELETE FROM auth")
    conn.execute("INSERT INTO auth (salt, key_check) VALUES (?, ?)", (salt, key_check))
    conn.commit()


def get_auth(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute("SELECT salt, key_check FROM auth LIMIT 1").fetchone()
    if row is None:
        return None
    return {"salt": row["salt"], "key_check": row["key_check"]}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_entry(
    conn: sqlite3.Connection,
    title: str,
    blob: str,
    word_count: int,
    body_for_fts: str = "",
) -> int:
    now = _now()
    cur = conn.execute(
        "INSERT INTO entries (title, blob, created_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?)",
        (title, blob, now, now, word_count),
    )
    entry_id = cur.lastrowid
    conn.execute(
        "INSERT INTO entries_fts (entry_id, title, body) VALUES (?, ?, ?)",
        (entry_id, title, body_for_fts),
    )
    conn.commit()
    return entry_id


def get_entries(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT id, title, created_at, updated_at, word_count FROM entries ORDER BY updated_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_entry(conn: sqlite3.Connection, entry_id: int) -> dict | None:
    row = conn.execute(
        "SELECT id, title, blob, created_at, updated_at, word_count FROM entries WHERE id = ?",
        (entry_id,),
    ).fetchone()
    return dict(row) if row else None


def update_entry(
    conn: sqlite3.Connection,
    entry_id: int,
    title: str,
    blob: str,
    word_count: int,
    body_for_fts: str = "",
):
    now = _now()
    conn.execute(
        "UPDATE entries SET title=?, blob=?, updated_at=?, word_count=? WHERE id=?",
        (title, blob, now, word_count, entry_id),
    )
    conn.execute("DELETE FROM entries_fts WHERE entry_id=?", (entry_id,))
    conn.execute(
        "INSERT INTO entries_fts (entry_id, title, body) VALUES (?, ?, ?)",
        (entry_id, title, body_for_fts),
    )
    conn.commit()


def delete_entry(conn: sqlite3.Connection, entry_id: int):
    conn.execute("DELETE FROM entries WHERE id=?", (entry_id,))
    conn.execute("DELETE FROM entries_fts WHERE entry_id=?", (entry_id,))
    conn.commit()


def search_entries(conn: sqlite3.Connection, query: str) -> list[dict]:
    if not query.strip():
        return get_entries(conn)
    rows = conn.execute(
        """
        SELECT e.id, e.title, e.created_at, e.updated_at, e.word_count
        FROM entries e
        JOIN entries_fts f ON f.entry_id = e.id
        WHERE entries_fts MATCH ?
        ORDER BY rank
        """,
        (query,),
    ).fetchall()
    return [dict(r) for r in rows]
