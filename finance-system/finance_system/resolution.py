"""Evidence resolution: supply proof, recalculate, supersede snapshots, reclassify (§10).

Prior calculation snapshots and prior verification states are preserved (snapshots are
append-only and superseded, not overwritten; the audit log retains the transition). New
snapshots are created for the affected line and the exception is resolved with its
reclassification result recorded.
"""

from __future__ import annotations

import json
import sqlite3

from . import audit, cost_evidence, posting, snapshots
from .db import utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .money import Money
from .models import CostComponentType, ExceptionStatus
from .policies import CalculationPolicy
from .verification import CalculationType, VerificationLevel


def _reclassify_line(conn, txn_id, line_id, matrix: EvidenceMatrix,
                     policy_key: str | None = None) -> dict:
    """Reclassify ONE line and update only that line's calculation-level verification rows.

    Multi-line aware: the normalized record comes from the LINE's own source row (not the
    document header), and the UPDATE is scoped to ``transaction_line_id`` so resolving one
    line never silently verifies its siblings.

    Recorded cost evidence (``cost_evidence``) is consulted too, so an accepted alternative
    to a vendor bill (purchase order, quote, approved historical cost, ...) upgrades the
    line's cost classification per policy.
    """
    src = conn.execute(
        """SELECT sr.normalized_json FROM source_records sr
           JOIN transaction_lines l ON l.source_record_id = sr.id WHERE l.id=?""",
        (line_id,)).fetchone()
    if src is None:                      # fall back to the document header lineage
        src = conn.execute(
            """SELECT sr.normalized_json FROM source_records sr
               JOIN transactions t ON t.source_record_id = sr.id WHERE t.id=?""",
            (txn_id,)).fetchone()
    norm = json.loads(src["normalized_json"]) if src and src["normalized_json"] else {}
    # reflect current cost presence from the DB (evidence may have just been added)
    pc = conn.execute(
        """SELECT COALESCE(SUM(amount_minor),0) AS s FROM cost_components
           WHERE transaction_line_id=? AND component_type='product_cost'""", (line_id,)).fetchone()["s"]
    if pc:
        norm["product_cost"] = str(Money.from_minor(pc).as_decimal())
    txn = conn.execute("SELECT transaction_type FROM transactions WHERE id=?", (txn_id,)).fetchone()
    rv = matrix.classify_record(norm, txn["transaction_type"])

    levels = {}
    for calc, cv in rv.by_calc.items():
        level = cv.level.value
        missing, note = cv.missing_fields, cv.note
        if calc is CalculationType.COST and policy_key:
            verdict = cost_evidence.evaluate_line(conn, line_id, policy_key)
            rank = {"unverified": 0, "provisional": 1, "verified": 2}
            if rank[verdict.level] > rank[level]:
                level, missing, note = verdict.level, [], verdict.reason
        conn.execute(
            """UPDATE record_verifications SET level=?, missing_fields_json=?, note=?
               WHERE transaction_id=? AND transaction_line_id=? AND calculation_type=?""",
            (level, json.dumps(missing), note, txn_id, line_id, calc.value))
        levels[calc.value] = level
    return levels


def apply_cost_evidence(
    conn: sqlite3.Connection, *, transaction_line_id: str, evidence_type: str,
    policy, matrix: EvidenceMatrix, amount: str | None = None,
    source_reference: str | None = None, evidence_date: str | None = None,
    approved_by: str | None = None, expires_on: str | None = None,
    actor: str | None = None,
) -> dict:
    """Record alternative cost evidence on a line, then recalculate and reclassify it.

    This is the non-vendor-bill path: a purchase order, vendor quote, approved historical
    cost, and so on. The line's cost classification is re-evaluated against the configured
    acceptance policy, new snapshots supersede the prior ones, and the transition is audited.
    """
    line = conn.execute(
        "SELECT * FROM transaction_lines WHERE id=?", (transaction_line_id,)).fetchone()
    if line is None:
        raise KeyError(f"unknown transaction line {transaction_line_id!r}")
    txn = conn.execute(
        "SELECT * FROM transactions WHERE id=?", (line["transaction_id"],)).fetchone()
    with conn:
        cost_evidence.record_evidence(
            conn, evidence_type=evidence_type, transaction_line_id=transaction_line_id,
            amount=amount, source_reference=source_reference, evidence_date=evidence_date,
            transaction_id=txn["id"], approved_by=approved_by, expires_on=expires_on)
        levels = _reclassify_line(conn, txn["id"], transaction_line_id, matrix, policy.key())
        new_snaps = posting.persist_line_snapshots(conn, txn, line, policy, supersede=True)
        audit.record_event(
            conn, "cost_evidence_applied",
            f"{evidence_type} recorded; cost now '{levels.get('cost')}'; {new_snaps} new snapshots",
            entity_kind="transaction_line", entity_id=transaction_line_id, actor=actor,
            detail={"evidence_type": evidence_type, "cost_level": levels.get("cost")})
    return {"levels": levels, "new_snapshots": new_snaps,
            "cost_level": levels.get("cost")}


def supply_cost_evidence(
    conn: sqlite3.Connection, exception_id: str, *, product_cost: str,
    policy: CalculationPolicy, matrix: EvidenceMatrix,
    vendor_bill_number: str | None = None, evidence_ref: str | None = None,
    actor: str | None = None,
) -> dict:
    """Attach missing product cost, recalculate, supersede snapshots, reclassify, resolve."""
    exc = conn.execute("SELECT * FROM exceptions WHERE id=?", (exception_id,)).fetchone()
    if exc is None:
        raise KeyError(f"unknown exception {exception_id!r}")
    txn_id, line_id = exc["transaction_id"], exc["transaction_line_id"]

    with conn:
        # 1. attach evidence (add the product cost component)
        existing = conn.execute(
            """SELECT id FROM cost_components WHERE transaction_line_id=? AND component_type='product_cost'""",
            (line_id,)).fetchone()
        if existing:
            conn.execute("UPDATE cost_components SET amount_minor=?, vendor_bill_number=? WHERE id=?",
                         (Money.of(product_cost).minor, vendor_bill_number, existing["id"]))
        else:
            conn.execute(
                """INSERT INTO cost_components(id, transaction_line_id, transaction_id,
                   component_type, amount_minor, currency, vendor_bill_number, created_at)
                   VALUES (?, ?, ?, 'product_cost', ?, 'USD', ?, ?)""",
                (new_id("cost_component"), line_id, txn_id, Money.of(product_cost).minor,
                 vendor_bill_number, utcnow_iso()))

        # 2. reclassify affected calculations (UPDATE; prior state retained in audit + snapshots)
        levels = _reclassify_line(conn, txn_id, line_id, matrix, policy.key())

        # 3. recalculate + create NEW snapshots superseding prior ones (originals preserved)
        txn = conn.execute("SELECT * FROM transactions WHERE id=?", (txn_id,)).fetchone()
        line = conn.execute("SELECT * FROM transaction_lines WHERE id=?", (line_id,)).fetchone()
        new_snaps = posting.persist_line_snapshots(conn, txn, line, policy, supersede=True)

        # 4. resolve this exception and any sibling now-verified exceptions on the line
        resolved = []
        for e in conn.execute(
                "SELECT * FROM exceptions WHERE transaction_line_id=? AND status!=?",
                (line_id, ExceptionStatus.RESOLVED.value)).fetchall():
            calc = e["calculation_type"]
            if calc and levels.get(calc) in (VerificationLevel.VERIFIED.value,
                                             VerificationLevel.PROVISIONAL.value):
                conn.execute(
                    """UPDATE exceptions SET status=?, resolved_at=?, resolution_note=?,
                       resolution_evidence=?, reclassification_result=? WHERE id=?""",
                    (ExceptionStatus.RESOLVED.value, utcnow_iso(),
                     f"cost evidence supplied ({evidence_ref or 'manual'})",
                     evidence_ref or vendor_bill_number, levels.get(calc), e["id"]))
                resolved.append(e["id"])

        audit.record_event(conn, "evidence_resolved_cost",
                           f"cost evidence supplied; {new_snaps} new snapshots; "
                           f"{len(resolved)} exception(s) resolved",
                           entity_kind="transaction", entity_id=txn_id, actor=actor,
                           detail={"new_snapshots": new_snaps, "resolved": len(resolved)})
    return {"levels": levels, "new_snapshots": new_snaps, "resolved_exceptions": resolved}
