"""Traceability: explain exactly why a number appears in a report (Exchange 3).

Given a transaction (or line), assemble the full provenance an operator needs to trust a
figure: header and lines, dates, external identifiers, costs, verification state per
calculation, current calculation snapshots WITH their inputs, superseded snapshot history,
open exceptions, reconciliation findings, cash application, and the original source row.
Read-only.
"""

from __future__ import annotations

import json
import sqlite3

from . import cash, snapshots
from .money import Money, quantity_from_stored


def _money(minor) -> str:
    return str(Money.from_minor(minor or 0).rounded())


def explain_transaction(conn: sqlite3.Connection, transaction_id: str) -> dict:
    txn = conn.execute("SELECT * FROM transactions WHERE id=?", (transaction_id,)).fetchone()
    if txn is None:
        raise KeyError(f"unknown transaction {transaction_id!r}")

    external = [dict(r) for r in conn.execute(
        "SELECT namespace, value FROM external_identifiers WHERE entity_id=?", (transaction_id,))]
    customer = conn.execute(
        "SELECT name FROM customers WHERE id=?", (txn["customer_id"],)).fetchone() if txn["customer_id"] else None

    lines = []
    for l in conn.execute(
            "SELECT * FROM transaction_lines WHERE transaction_id=? ORDER BY line_number",
            (transaction_id,)):
        costs = [{"component": r["component_type"], "amount": _money(r["amount_minor"]),
                  "vendor_bill": r["vendor_bill_number"]}
                 for r in conn.execute(
                     "SELECT * FROM cost_components WHERE transaction_line_id=?", (l["id"],))]
        verifications = {r["calculation_type"]: {"level": r["level"],
                                                 "missing": json.loads(r["missing_fields_json"] or "[]"),
                                                 "note": r["note"]}
                         for r in conn.execute(
                             """SELECT * FROM record_verifications WHERE transaction_line_id=?""",
                             (l["id"],))}
        current = {}
        for s in snapshots.current_snapshots(conn, transaction_ids=(transaction_id,)):
            if s["source_line_id"] != l["id"]:
                continue
            current[s["calculation_name"]] = {
                "output": s["output_value"], "kind": s["output_kind"],
                "verification": s["verification_level"],
                "inputs": json.loads(s["inputs_json"] or "{}"),
                "policy": s["policy_key"], "formula_version": s["formula_version"],
                "calculated_at": s["created_at"],
            }
        superseded = [
            {"calculation": s["calculation_name"], "output": s["output_value"],
             "calculated_at": s["created_at"], "superseded_by_later_snapshot": True}
            for s in conn.execute(
                """SELECT * FROM calculation_snapshots WHERE source_line_id=?
                   AND id IN (SELECT superseded_snapshot_id FROM calculation_snapshots
                              WHERE superseded_snapshot_id IS NOT NULL)
                   ORDER BY created_at""", (l["id"],))]
        source = conn.execute(
            "SELECT row_number, raw_json, row_error FROM source_records WHERE id=?",
            (l["source_record_id"],)).fetchone() if l["source_record_id"] else None
        evidence = [dict(r) for r in conn.execute(
            """SELECT evidence_type, source_reference, evidence_date, amount_minor, expires_on
               FROM cost_evidence WHERE transaction_line_id=?""", (l["id"],))]
        lines.append({
            "line_id": l["id"], "line_number": l["line_number"], "description": l["description"],
            "quantity": str(quantity_from_stored(l["quantity_minor"] or 0)),
            "unit_price": _money(l["unit_sales_price_minor"]),
            "discount": _money(l["discount_minor"]), "return": _money(l["return_minor"]),
            "freight_billed": _money(l["customer_shipping_minor"]),
            "crating_billed": _money(l["customer_crating_minor"]),
            "tax": _money(l["tax_minor"]),
            "costs": costs, "cost_evidence": evidence,
            "verification_by_calculation": verifications,
            "current_snapshots": current,
            "superseded_snapshots": superseded,
            "source_row": ({"row_number": source["row_number"],
                            "raw": json.loads(source["raw_json"]),
                            "row_error": source["row_error"]} if source else None),
        })

    exceptions = [dict(r) for r in conn.execute(
        """SELECT id, calculation_type, missing_information, proof_needed, priority, status
           FROM exceptions WHERE transaction_id=?""", (transaction_id,))]
    findings = [dict(r) for r in conn.execute(
        """SELECT rule, severity, status, expected_value, actual_value, difference, explanation
           FROM reconciliation_findings WHERE subject_ref=?""", (transaction_id,))]
    audit_trail = [dict(r) for r in conn.execute(
        """SELECT kind, summary, actor, created_at FROM audit_events
           WHERE entity_id=? ORDER BY created_at""", (transaction_id,))]

    cash_view = None
    if txn["transaction_type"] == "invoice":
        st = cash.ar_status(conn, transaction_id)
        applications = [dict(r) for r in conn.execute(
            """SELECT kind, amount_minor, note, created_at FROM payment_applications
               WHERE invoice_transaction_id=? ORDER BY created_at""", (transaction_id,))]
        cash_view = {"invoiced": str(st.invoiced.rounded()), "applied": str(st.applied.rounded()),
                     "balance": str(st.balance.rounded()), "status": st.status,
                     "applications": [{**a, "amount": _money(a.pop("amount_minor"))}
                                      for a in applications]}

    return {
        "transaction_id": transaction_id,
        "type": txn["transaction_type"],
        "customer": customer["name"] if customer else None,
        "external_identifiers": external,
        "dates": {k: txn[k] for k in ("transaction_date", "order_date", "invoice_date",
                                      "ship_date", "due_date", "payment_date",
                                      "period_assignment_date") if txn[k]},
        "posted": bool(txn["posted"]),
        "review_status": txn["review_status"],
        "line_count": txn["line_count"],
        "header_total": (_money(txn["header_total_minor"])
                         if txn["header_total_minor"] is not None else None),
        "lines": lines,
        "exceptions": exceptions,
        "reconciliation_findings": findings,
        "cash_application": cash_view,
        "audit_trail": audit_trail,
    }


def find_transactions(conn: sqlite3.Connection, query: str, limit: int = 25) -> list:
    """Look up documents by external identifier, customer name, or product description."""
    like = f"%{query.strip()}%"
    rows = conn.execute(
        """SELECT DISTINCT t.id, t.transaction_type, t.invoice_date, t.line_count, c.name AS customer
           FROM transactions t
           LEFT JOIN customers c ON c.id = t.customer_id
           LEFT JOIN external_identifiers e ON e.entity_id = t.id
           LEFT JOIN transaction_lines l ON l.transaction_id = t.id
           WHERE e.value LIKE ? OR c.name LIKE ? OR l.description LIKE ?
           ORDER BY t.created_at DESC LIMIT ?""", (like, like, like, limit)).fetchall()
    return [dict(r) for r in rows]
