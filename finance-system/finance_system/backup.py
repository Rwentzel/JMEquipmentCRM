"""Backup, validation, preview, and safe restore (Exchange 3).

A backup is a plain SQLite file. Restoring is never done blind: :func:`validate_backup`
opens the copy read-only and checks integrity, schema version, and record counts;
:func:`preview_restore` reports what would change against the active database; and
:func:`restore` refuses to overwrite anything until it has taken an automatic safety
backup of the current database first.
"""

from __future__ import annotations

import shutil
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

from .db import init_db, utcnow_iso

_COUNTED = ("transactions", "transaction_lines", "calculation_snapshots", "exceptions",
            "payment_applications", "audit_events", "import_batches", "reporting_periods")


def _stamp() -> str:
    return utcnow_iso().replace(":", "").replace("-", "").replace(".", "")


def create_backup(conn: sqlite3.Connection, dest: str | Path) -> Path:
    """Write a consistent backup of the live database (commits first to release locks)."""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    conn.commit()
    target = sqlite3.connect(str(dest))
    try:
        conn.backup(target)
    finally:
        target.close()
    return dest


@dataclass
class BackupReport:
    path: str
    ok: bool
    integrity: str = ""
    schema_version: str = ""
    counts: dict = field(default_factory=dict)
    problems: list = field(default_factory=list)

    def summary(self) -> str:
        state = "VALID" if self.ok else "INVALID"
        return (f"{state}: {self.path} (schema {self.schema_version}, "
                f"{self.counts.get('transactions', 0)} transactions)")


def validate_backup(path: str | Path) -> BackupReport:
    """Open a backup read-only and verify it is a usable finance-system database."""
    p = Path(path)
    rep = BackupReport(str(p), ok=False)
    if not p.is_file():
        rep.problems.append("file does not exist")
        return rep
    if p.stat().st_size == 0:
        rep.problems.append("file is empty")
        return rep
    try:
        conn = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        rep.problems.append(f"cannot open: {exc}")
        return rep
    try:
        conn.row_factory = sqlite3.Row
        rep.integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        if rep.integrity != "ok":
            rep.problems.append(f"integrity_check: {rep.integrity}")
        row = conn.execute(
            "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").fetchone()
        rep.schema_version = row["version"] if row else ""
        if not rep.schema_version:
            rep.problems.append("no schema_migrations rows — not a finance-system database")
        for table in _COUNTED:
            try:
                rep.counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            except sqlite3.Error:
                rep.problems.append(f"missing table: {table}")
        # append-only guarantee must still be enforced in the restored copy
        trig = conn.execute(
            """SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'
               AND tbl_name IN ('calculation_snapshots','audit_events')""").fetchone()[0]
        if trig == 0:
            rep.problems.append("append-only triggers are missing")
    except sqlite3.DatabaseError as exc:
        rep.problems.append(f"not a valid database: {exc}")
    finally:
        conn.close()
    rep.ok = not rep.problems
    return rep


def preview_restore(backup_path: str | Path, active_db_path: str | Path) -> dict:
    """Report what restoring would change, WITHOUT touching the active database."""
    backup = validate_backup(backup_path)
    active_exists = Path(active_db_path).is_file()
    active = validate_backup(active_db_path) if active_exists else None
    deltas = {}
    if active and active.ok:
        for table in _COUNTED:
            deltas[table] = {"active": active.counts.get(table, 0),
                             "backup": backup.counts.get(table, 0),
                             "change": backup.counts.get(table, 0) - active.counts.get(table, 0)}
    return {
        "backup": {"path": backup.path, "valid": backup.ok, "schema": backup.schema_version,
                   "problems": backup.problems, "counts": backup.counts},
        "active_database_exists": active_exists,
        "record_deltas_if_restored": deltas,
        "safe_to_restore": backup.ok,
        "note": ("restore replaces the active database; a safety backup of the current "
                 "database is taken automatically first"),
    }


def restore(backup_path: str | Path, active_db_path: str | Path,
            *, confirm: bool = False) -> dict:
    """Restore a validated backup over the active database, after a safety backup.

    Refuses unless the backup validates and ``confirm=True`` is passed explicitly.
    """
    backup = validate_backup(backup_path)
    if not backup.ok:
        raise ValueError(f"refusing to restore an invalid backup: {backup.problems}")
    if not confirm:
        raise ValueError("restore requires confirm=True (destructive operation)")
    active = Path(active_db_path)
    safety = None
    if active.is_file():
        safety = active.parent / f"pre-restore-safety-{_stamp()}.db"
        shutil.copy2(active, safety)
    active.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path(backup_path), active)
    verified = validate_backup(active)
    return {"restored_from": str(backup_path), "active_database": str(active),
            "safety_backup": str(safety) if safety else None,
            "restored_ok": verified.ok, "problems": verified.problems}
