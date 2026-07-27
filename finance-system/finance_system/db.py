"""SQLite connection + forward-only migration runner.

Mirrors the proven pattern from the repo's ``rfqStore.ts`` (a small, swappable
persistence API; real data confined to a gitignored data dir) but in Python/SQLite.

The database file lives under a gitignored data directory (default
``finance-system/.data/finance.db``) so authoritative financial data never enters
git. Migrations are plain ``.sql`` files in ``migrations/`` applied in filename order
and recorded in ``schema_migrations``.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

_MIGRATIONS_DIR = Path(__file__).with_name("migrations")
# Default under the package's sibling .data dir (gitignored). Override via env.
_DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / ".data"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def data_dir() -> Path:
    return Path(os.environ.get("FINANCE_DATA_DIR", str(_DEFAULT_DATA_DIR)))


def default_db_path() -> Path:
    return data_dir() / "finance.db"


def connect(db_path: str | os.PathLike | None = None) -> sqlite3.Connection:
    """Open a connection with foreign keys enforced and dict-like rows.

    ``:memory:`` is honoured for tests. On-disk paths have their parent created.
    """
    if db_path is None:
        db_path = default_db_path()
    path_str = str(db_path)
    if path_str != ":memory:":
        Path(path_str).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path_str)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _applied_versions(conn: sqlite3.Connection) -> set[str]:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
    ).fetchone()
    if not row:
        return set()
    return {r[0] for r in conn.execute("SELECT version FROM schema_migrations")}


def migration_files() -> list[Path]:
    return sorted(_MIGRATIONS_DIR.glob("*.sql"))


def migrate(conn: sqlite3.Connection) -> list[str]:
    """Apply all pending migrations in order. Returns the versions applied now."""
    applied = _applied_versions(conn)
    newly: list[str] = []
    for sql_file in migration_files():
        version = sql_file.stem  # e.g. "0001_initial"
        if version in applied:
            continue
        sql = sql_file.read_text(encoding="utf-8")
        with conn:  # transactional: a failed migration rolls back cleanly
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                (version, utcnow_iso()),
            )
        newly.append(version)
    return newly


def init_db(db_path: str | os.PathLike | None = None) -> sqlite3.Connection:
    """Open (creating dirs as needed) and migrate to the latest schema."""
    conn = connect(db_path)
    migrate(conn)
    return conn
