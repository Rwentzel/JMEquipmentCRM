"""Reconciliation engine (§11). Explicit tolerances; rounding is never hidden."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from decimal import Decimal

from .db import utcnow_iso
from .ids import new_id
from .money import Money, quantity_from_stored

MONEY_TOLERANCE_MINOR = 100  # 0.0100 at scale 4


@dataclass
class Recon:
    rule: str
    expected: str
    actual: str
    difference: str
    tolerance: str
    status: str          # within_tolerance | exception
    severity: str
    explanation: str
    related: list[str] = field(default_factory=list)


def _within(diff_minor: int) -> bool:
    return abs(diff_minor) <= MONEY_TOLERANCE_MINOR


def reconcile_posted(conn: sqlite3.Connection, period_id: str | None = None,
                     batch_id: str | None = None) -> list[Recon]:
    out: list[Recon] = []
    clauses = ["posted=1"]
    params: list = []
    if period_id:
        clauses.append("reporting_period_id=?"); params.append(period_id)
    if batch_id:
        clauses.append("import_batch_id=?"); params.append(batch_id)
    txns = conn.execute(
        f"SELECT * FROM transactions WHERE {' AND '.join(clauses)}", params).fetchall()
    for t in txns:
        line = conn.execute(
            "SELECT * FROM transaction_lines WHERE transaction_id=? LIMIT 1", (t["id"],)).fetchone()
        if not line:
            continue
        qty = quantity_from_stored(line["quantity_minor"] or 0)
        unit = Money.from_minor(line["unit_sales_price_minor"] or 0)
        extended = unit.multiply(qty)

        # header vs line totals
        if t["header_total_minor"] is not None:
            header = Money.from_minor(t["header_total_minor"])
            diff = (header - extended).minor
            out.append(Recon(
                "header_vs_line_total", str(extended.rounded()), str(header.rounded()),
                str(Money.from_minor(diff).rounded()), "0.01",
                "within_tolerance" if _within(diff) else "exception",
                "low" if _within(diff) else "medium",
                "header total reconciled to line extended amount", [t["id"]]))

        # customer freight revenue vs freight-out cost (freight recovery)
        fout = conn.execute(
            """SELECT COALESCE(SUM(amount_minor),0) AS s FROM cost_components
               WHERE transaction_line_id=? AND component_type='freight_out'""",
            (line["id"],)).fetchone()["s"]
        billed = line["customer_shipping_minor"] or 0
        if fout or billed:
            diff = billed - fout
            out.append(Recon(
                "freight_revenue_vs_cost", str(Money.from_minor(fout).rounded()),
                str(Money.from_minor(billed).rounded()), str(Money.from_minor(diff).rounded()),
                "0.01", "within_tolerance" if diff >= 0 else "exception",
                "low" if diff >= 0 else "medium",
                "freight billed vs freight-out cost (negative = under-recovery)", [t["id"]]))

        # period assignment vs source dates
        if period_id:
            per = conn.execute("SELECT start_date, end_date FROM reporting_periods WHERE id=?",
                               (period_id,)).fetchone()
            pad = t["period_assignment_date"]
            if per and pad and not (per["start_date"] <= pad <= per["end_date"]):
                out.append(Recon(
                    "period_assignment_vs_source", f"{per['start_date']}..{per['end_date']}",
                    pad, "n/a", "n/a", "exception", "medium",
                    "period-assignment date falls outside the reporting period", [t["id"]]))

        # commission calc vs policy (recompute check)
        cc = conn.execute(
            "SELECT * FROM commission_calculations WHERE transaction_id=? LIMIT 1", (t["id"],)).fetchone()
        if cc and cc["basis_amount_minor"] is not None and cc["rate_canonical"]:
            expected = Money.from_minor(cc["basis_amount_minor"]).multiply(Decimal(cc["rate_canonical"]))
            diff = (expected - Money.from_minor(cc["commission_minor"] or 0)).minor
            out.append(Recon(
                "commission_vs_policy", str(expected.rounded()),
                str(Money.from_minor(cc["commission_minor"] or 0).rounded()),
                str(Money.from_minor(diff).rounded()), "0.01",
                "within_tolerance" if _within(diff) else "exception",
                "low" if _within(diff) else "high",
                "commission amount reconciled to basis x rate", [t["id"]]))

    # duplicate external identifiers across distinct entities — limited to the scoped
    # transaction population so a batch/period reconciliation is not inflated by unrelated
    # historical records.
    scoped_ids = [t["id"] for t in txns]
    if scoped_ids:
        placeholders = ",".join("?" * len(scoped_ids))
        dup = conn.execute(
            f"""SELECT namespace, value, COUNT(DISTINCT entity_id) AS n FROM external_identifiers
                WHERE entity_id IN ({placeholders})
                GROUP BY namespace, value HAVING n>1""", scoped_ids).fetchall()
    else:
        dup = []
    for d in dup:
        out.append(Recon(
            "duplicate_external_identifier", "1 entity", f"{d['n']} entities", str(d["n"] - 1),
            "0", "exception", "high",
            f"external id {d['namespace']}={d['value']} maps to {d['n']} entities", []))
    return out


def persist_recon(conn: sqlite3.Connection, recons: list[Recon],
                  batch_id: str | None = None, period_id: str | None = None) -> int:
    n = 0
    for r in recons:
        conn.execute(
            """INSERT INTO reconciliation_findings(id, finding_type, severity, subject_ref,
               detail, rule, expected_value, actual_value, difference, tolerance, status,
               explanation, related_json, import_batch_id, reporting_period_id, created_at)
               VALUES (?, 'reconciliation', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_id("reconciliation_finding"), r.severity, (r.related[0] if r.related else r.rule),
             r.explanation, r.rule, r.expected, r.actual, r.difference, r.tolerance, r.status,
             r.explanation, json.dumps(r.related), batch_id, period_id, utcnow_iso()))
        n += 1
    return n
