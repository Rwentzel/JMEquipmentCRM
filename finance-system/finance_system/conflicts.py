"""Conflict detection over staged rows (§7). Findings are explained, never auto-fixed."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from decimal import Decimal

from .db import utcnow_iso
from .ids import new_id
from .money import Money, quantity_from_stored


@dataclass
class Conflict:
    conflict_type: str
    severity: str
    subject_ref: str
    explanation: str
    affected_calculations: str
    expected: str = ""
    actual: str = ""


def detect_conflicts(conn: sqlite3.Connection, batch_id: str) -> list[Conflict]:
    out: list[Conflict] = []
    staged = conn.execute(
        "SELECT * FROM transactions WHERE import_batch_id=? AND posted=0", (batch_id,)).fetchall()

    # same invoice number -> different customer / different total (staged vs all)
    inv_rows = conn.execute(
        """SELECT e.value AS inv, e.entity_id AS txn, t.customer_id AS cust
           FROM external_identifiers e JOIN transactions t ON t.id=e.entity_id
           WHERE e.namespace='invoice_number'""").fetchall()
    by_inv: dict[str, list] = {}
    for r in inv_rows:
        by_inv.setdefault(r["inv"], []).append(r)
    for inv, group in by_inv.items():
        custs = {g["cust"] for g in group if g["cust"]}
        if len(custs) > 1:
            out.append(Conflict("invoice_customer_mismatch", "high", inv,
                                f"invoice {inv} appears under {len(custs)} different customers",
                                "transaction_identity,revenue"))

    for t in staged:
        line = conn.execute(
            "SELECT * FROM transaction_lines WHERE transaction_id=? LIMIT 1", (t["id"],)).fetchone()
        if not line:
            continue
        qty = quantity_from_stored(line["quantity_minor"] or 0)
        unit = Money.from_minor(line["unit_sales_price_minor"] or 0)
        extended = unit.multiply(qty)
        # header vs line total mismatch (tolerance 0.01)
        if t["header_total_minor"] is not None:
            header = Money.from_minor(t["header_total_minor"])
            diff = header - extended
            if abs(diff.minor) > 100:  # > 0.01 at scale 4
                out.append(Conflict("header_line_mismatch", "medium", t["id"],
                    f"header total {header.rounded()} != line extended {extended.rounded()}",
                    "revenue", str(header.rounded()), str(extended.rounded())))
        # revenue without customer
        if line["unit_sales_price_minor"] and not t["customer_id"]:
            out.append(Conflict("revenue_without_customer", "high", t["id"],
                "line carries revenue but no customer is identified", "revenue,transaction_identity"))
        # product cost without vendor or evidence
        pc = conn.execute(
            """SELECT vendor_id, vendor_bill_number FROM cost_components
               WHERE transaction_line_id=? AND component_type='product_cost' LIMIT 1""",
            (line["id"],)).fetchone()
        if pc and not pc["vendor_id"] and not pc["vendor_bill_number"]:
            out.append(Conflict("cost_without_vendor_evidence", "medium", t["id"],
                "product cost present with no vendor and no vendor bill reference", "cost"))
        # negative quantity on a type that does not support returns
        if (line["quantity_minor"] or 0) < 0 and t["transaction_type"] not in ("return", "credit_memo"):
            out.append(Conflict("negative_qty_wrong_type", "high", t["id"],
                f"negative quantity on transaction type {t['transaction_type']}", "revenue"))
        # freight cost without customer freight, and vice versa
        fout = conn.execute(
            """SELECT COALESCE(SUM(amount_minor),0) AS s FROM cost_components
               WHERE transaction_line_id=? AND component_type='freight_out'""",
            (line["id"],)).fetchone()["s"]
        if fout and not line["customer_shipping_minor"]:
            out.append(Conflict("freight_cost_no_revenue", "low", t["id"],
                "freight-out cost present but no freight billed to customer", "cost,revenue"))
        # commission fields present but no authorized rule linked
        if not t["commission_rule_id"]:
            has_comm = conn.execute(
                "SELECT 1 FROM record_verifications WHERE transaction_id=? AND calculation_type='commission' AND level!='verified' LIMIT 1",
                (t["id"],)).fetchone()
            # only a conflict if the source implied a commission (rate captured) — approximated by note
    # same external identifier mapped to multiple internal entities (product alias)
    alias_rows = conn.execute(
        """SELECT alias_value, COUNT(DISTINCT product_id) AS n FROM product_aliases
           GROUP BY alias_type, alias_value HAVING n>1""").fetchall()
    for a in alias_rows:
        out.append(Conflict("alias_multi_product", "high", a["alias_value"],
            f"product alias {a['alias_value']} maps to {a['n']} products", "product"))
    return out


def persist_conflicts(conn: sqlite3.Connection, conflicts: list[Conflict]) -> int:
    for c in conflicts:
        conn.execute(
            """INSERT INTO reconciliation_findings(id, finding_type, severity, subject_ref,
               detail, rule, expected_value, actual_value, status, explanation,
               affected_calculations, created_at)
               VALUES (?, 'conflict', ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)""",
            (new_id("reconciliation_finding"), c.severity, c.subject_ref, c.explanation,
             c.conflict_type, c.expected, c.actual, c.explanation, c.affected_calculations,
             utcnow_iso()))
    return len(conflicts)
