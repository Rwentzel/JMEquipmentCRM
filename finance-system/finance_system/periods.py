"""Reporting-period lifecycle (Exchange 3).

    open -> under_review -> verified -> locked        (normal close)
    locked -> open                                    (reopen: requires authorization + reason)

Every transition is recorded in ``period_transitions`` and the append-only audit log. A
locked period refuses posting (enforced in :mod:`finance_system.imports`); reopening it is
deliberately awkward — it demands an explicit authorizer and a written reason.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Optional

from . import audit
from .db import utcnow_iso
from .ids import new_id

OPEN = "open"
UNDER_REVIEW = "under_review"
VERIFIED = "verified"
LOCKED = "locked"

STATES = (OPEN, UNDER_REVIEW, VERIFIED, LOCKED)

# Allowed forward transitions. Reopen (locked -> open) is handled separately because it
# requires authorization and a reason.
_ALLOWED = {
    OPEN: {UNDER_REVIEW},
    UNDER_REVIEW: {VERIFIED, OPEN},
    VERIFIED: {LOCKED, UNDER_REVIEW},
    LOCKED: set(),
}


class PeriodError(ValueError):
    """Raised when a period transition is not allowed."""


@dataclass
class Period:
    id: str
    label: str
    start_date: str
    end_date: str
    state: str
    locked: int


def create_period(conn: sqlite3.Connection, label: str, start_date: str, end_date: str,
                  actor: str | None = None) -> str:
    existing = conn.execute("SELECT id FROM reporting_periods WHERE label=?", (label,)).fetchone()
    if existing:
        raise PeriodError(f"reporting period {label!r} already exists")
    pid = new_id("reporting_period")
    conn.execute(
        """INSERT INTO reporting_periods(id, label, start_date, end_date, locked, state, created_at)
           VALUES (?, ?, ?, ?, 0, ?, ?)""", (pid, label, start_date, end_date, OPEN, utcnow_iso()))
    _record(conn, pid, "-", OPEN, "period created", actor)
    return pid


def get(conn: sqlite3.Connection, period_id: str) -> Period:
    r = conn.execute("SELECT * FROM reporting_periods WHERE id=?", (period_id,)).fetchone()
    if r is None:
        raise PeriodError(f"unknown reporting period {period_id!r}")
    return Period(r["id"], r["label"], r["start_date"], r["end_date"],
                  r["state"] or OPEN, r["locked"])


def _record(conn, period_id, from_state, to_state, reason, actor):
    conn.execute(
        """INSERT INTO period_transitions(id, period_id, from_state, to_state, reason,
           authorized_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (new_id("reconciliation_finding"), period_id, from_state, to_state, reason, actor,
         utcnow_iso()))
    audit.record_event(conn, "period_transition", f"{from_state} -> {to_state}",
                       entity_kind="reporting_period", entity_id=period_id, actor=actor,
                       detail={"from": from_state, "to": to_state, "reason": reason})


def transition(conn: sqlite3.Connection, period_id: str, to_state: str,
               *, reason: str | None = None, actor: str | None = None) -> Period:
    """Move a period forward through the close lifecycle."""
    if to_state not in STATES:
        raise PeriodError(f"unknown period state {to_state!r}")
    p = get(conn, period_id)
    if to_state == p.state:
        return p
    if to_state not in _ALLOWED[p.state]:
        raise PeriodError(
            f"cannot move period {p.label} from '{p.state}' to '{to_state}'"
            + (" — use reopen() with an authorizer and reason" if p.state == LOCKED else ""))
    locked = 1 if to_state == LOCKED else 0
    conn.execute(
        """UPDATE reporting_periods SET state=?, locked=?, locked_at=?, locked_by=? WHERE id=?""",
        (to_state, locked, utcnow_iso() if locked else None, actor if locked else None, period_id))
    _record(conn, period_id, p.state, to_state, reason, actor)
    return get(conn, period_id)


def lock(conn: sqlite3.Connection, period_id: str, *, actor: str | None = None,
         reason: str | None = None) -> Period:
    """Lock a period. Only a verified period may be locked."""
    p = get(conn, period_id)
    if p.state != VERIFIED:
        raise PeriodError(
            f"period {p.label} is '{p.state}'; it must be 'verified' before locking")
    return transition(conn, period_id, LOCKED, reason=reason or "period closed", actor=actor)


def reopen(conn: sqlite3.Connection, period_id: str, *, reason: str, authorized_by: str) -> Period:
    """Reopen a locked period. Requires an authorizer AND a written reason; both are audited."""
    p = get(conn, period_id)
    if p.state != LOCKED:
        raise PeriodError(f"period {p.label} is not locked (state '{p.state}')")
    if not reason or not reason.strip():
        raise PeriodError("reopening a locked period requires a written reason")
    if not authorized_by or not authorized_by.strip():
        raise PeriodError("reopening a locked period requires an authorizer")
    conn.execute(
        """UPDATE reporting_periods SET state=?, locked=0, reopen_reason=?, reopened_by=?,
           reopened_at=? WHERE id=?""",
        (OPEN, reason.strip(), authorized_by.strip(), utcnow_iso(), period_id))
    _record(conn, period_id, LOCKED, OPEN, f"REOPENED: {reason.strip()}", authorized_by.strip())
    return get(conn, period_id)


def history(conn: sqlite3.Connection, period_id: str) -> list:
    return [dict(r) for r in conn.execute(
        """SELECT from_state, to_state, reason, authorized_by, created_at
           FROM period_transitions WHERE period_id=? ORDER BY created_at, id""", (period_id,))]
