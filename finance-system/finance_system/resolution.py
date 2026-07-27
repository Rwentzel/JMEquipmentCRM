"""Evidence resolution: supply proof, recalculate, supersede snapshots, reclassify (§10).

Prior calculation snapshots and prior verification states are preserved (snapshots are
append-only and superseded, not overwritten; the audit log retains the transition). New
snapshots are created for the affected line and the exception is resolved with its
reclassification result recorded.
"""

from __future__ import annotations

import json
import sqlite3

from . import audit, posting, snapshots
from .db import utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .money import Money
from .models import CostComponentType, ExceptionStatus
from .policies import CalculationPolicy
from .verification import CalculationType, VerificationLevel


def _reclassify_line(conn, txn_id, line_id, matrix: EvidenceMatrix) -> dict:
    """Rebuild the normalized record for a transaction, reclassify, and UPDATE the
    calculation-level verification rows. Returns the new per-calc levels."""
    src = conn.execute(
        """SELECT sr.normalized_json FROM source_records sr
           JOIN transactions t ON t.source_record_id = sr.id WHERE t.id=?""", (txn_id,)).fetchone()
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
        conn.execute(
            """UPDATE record_verifications SET level=?, missing_fields_json=?, note=?
               WHERE transaction_id=? AND calculation_type=?""",
            (cv.level.value, json.dumps(cv.missing_fields), cv.note, txn_id, calc.value))
        levels[calc.value] = cv.level.value
    return levels


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
        levels = _reclassify_line(conn, txn_id, line_id, matrix)

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
