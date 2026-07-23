"""The "Where's Your Proof?" exception register (Section 2 / Operating Rule A).

Incomplete records are never discarded. When a calculation lacks critical evidence an
exception is logged with a unique id, the missing fields, why they matter, and the exact
proof needed. When proof later arrives the exception is RESOLVED and the record is
reclassified — the exception row itself is retained (append-to-history, not deleted), so
the audit trail is intact and verified totals are never retroactively corrupted.
"""

from __future__ import annotations

import sqlite3

from . import audit
from .db import utcnow_iso
from .ids import new_id
from .models import ExceptionPriority, ExceptionStatus
from .verification import CalcVerification, VerificationLevel


def raise_exception(
    conn: sqlite3.Connection,
    *,
    missing_information: str,
    why_critical: str,
    proof_needed: str,
    transaction_id: str | None = None,
    transaction_line_id: str | None = None,
    calculation_type: str | None = None,
    customer_ref: str | None = None,
    known_amount_minor: int | None = None,
    effect_on_totals: str | None = None,
    priority: ExceptionPriority = ExceptionPriority.MEDIUM,
    import_batch_id: str | None = None,
    reporting_period_id: str | None = None,
    source_record_id: str | None = None,
) -> str:
    exc_id = new_id("exception")
    conn.execute(
        """INSERT INTO exceptions
           (id, transaction_id, transaction_line_id, calculation_type, customer_ref,
            known_amount_minor, missing_information, why_critical, proof_needed,
            effect_on_totals, priority, status, import_batch_id, reporting_period_id,
            source_record_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (exc_id, transaction_id, transaction_line_id, calculation_type, customer_ref,
         known_amount_minor, missing_information, why_critical, proof_needed,
         effect_on_totals, priority.value, ExceptionStatus.OPEN.value, import_batch_id,
         reporting_period_id, source_record_id, utcnow_iso()),
    )
    audit.record_event(conn, "exception_opened", f"opened exception for {calculation_type or 'record'}",
                       entity_kind="exception", entity_id=exc_id,
                       detail={"calculation_type": calculation_type, "priority": priority.value})
    return exc_id


def exception_from_verification(
    conn: sqlite3.Connection,
    cv: CalcVerification,
    *,
    transaction_id: str | None = None,
    transaction_line_id: str | None = None,
    customer_ref: str | None = None,
    known_amount_minor: int | None = None,
    priority: ExceptionPriority = ExceptionPriority.MEDIUM,
    import_batch_id: str | None = None,
    reporting_period_id: str | None = None,
    source_record_id: str | None = None,
) -> str | None:
    """Create an exception iff the calculation is UNVERIFIED. Returns id or None."""
    if cv.level is not VerificationLevel.UNVERIFIED:
        return None
    missing = ", ".join(cv.missing_fields) or "unspecified"
    return raise_exception(
        conn,
        transaction_id=transaction_id,
        transaction_line_id=transaction_line_id,
        calculation_type=cv.calculation.value,
        customer_ref=customer_ref,
        known_amount_minor=known_amount_minor,
        missing_information=f"missing fields: {missing}",
        why_critical=cv.note or f"{cv.calculation.value} cannot be verified without this evidence",
        proof_needed=f"documentation supplying: {missing}",
        effect_on_totals=f"excluded from verified {cv.calculation.value} totals",
        priority=priority,
        import_batch_id=import_batch_id,
        reporting_period_id=reporting_period_id,
        source_record_id=source_record_id,
    )


def resolve_exception(conn: sqlite3.Connection, exception_id: str, resolution_note: str) -> None:
    """Mark an exception resolved (retained, not deleted). Reclassification of the
    underlying record is the caller's next step; the audit trail records the transition."""
    row = conn.execute("SELECT status FROM exceptions WHERE id = ?", (exception_id,)).fetchone()
    if row is None:
        raise KeyError(f"unknown exception {exception_id!r}")
    if row["status"] == ExceptionStatus.RESOLVED.value:
        return
    conn.execute(
        "UPDATE exceptions SET status = ?, resolved_at = ?, resolution_note = ? WHERE id = ?",
        (ExceptionStatus.RESOLVED.value, utcnow_iso(), resolution_note, exception_id),
    )
    audit.record_event(conn, "exception_resolved", "exception resolved; record reclassifiable",
                       entity_kind="exception", entity_id=exception_id,
                       detail={"resolution": resolution_note})


def open_exceptions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM exceptions WHERE status != ? ORDER BY priority, created_at",
        (ExceptionStatus.RESOLVED.value,),
    ).fetchall()
