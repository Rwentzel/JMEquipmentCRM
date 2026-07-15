"""Full A–K batch report (§12). Deterministic; verified totals exclude unsupported
profitability; provisional/exception/estimated/forecast are kept separate with bridges.
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal

from . import __version__
from .money import Money, quantity_from_stored
from .policies import CalculationPolicy
from .reporting import compute_separated_totals
from .verification import CalculationType, VerificationLevel

_COST_TYPES = ("product_cost", "freight_in", "freight_out", "crating", "direct_labor",
               "outside_services", "installation", "travel", "processing_fees",
               "tariffs", "other_direct")


def _level(conn, line_id, txn_id, calc):
    row = conn.execute(
        """SELECT level FROM record_verifications WHERE calculation_type=? AND
           (transaction_line_id=? OR (transaction_line_id IS NULL AND transaction_id=?))
           ORDER BY (transaction_line_id IS NULL) LIMIT 1""",
        (calc.value, line_id, txn_id)).fetchone()
    return row["level"] if row else "unverified"


def _cost_breakdown(conn) -> dict:
    out = {}
    for ct in _COST_TYPES:
        r = conn.execute(
            """SELECT COALESCE(SUM(c.amount_minor),0) AS s FROM cost_components c
               JOIN transactions t ON t.id=c.transaction_id WHERE t.posted=1 AND c.component_type=?""",
            (ct,)).fetchone()
        out[ct] = str(Money.from_minor(r["s"]).rounded())
    return out


def build_report(conn: sqlite3.Connection, batch_id: str, policy: CalculationPolicy,
                 period_id: str | None = None) -> dict:
    totals = compute_separated_totals(conn, policy)
    pop = totals.populations

    def count(q, *a):
        return conn.execute(q, a).fetchone()[0]

    # ---- A. Intake summary ----
    a = {
        "files": count("SELECT COUNT(*) FROM source_files WHERE import_batch_id=?", batch_id),
        "rows_received": count("SELECT COUNT(*) FROM source_records WHERE import_batch_id=?", batch_id),
        "rows_staged": count("SELECT COUNT(*) FROM transactions WHERE import_batch_id=?", batch_id),
        "rows_posted": count("SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND posted=1", batch_id),
        "rows_rejected": count("SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND review_status='rejected'", batch_id),
        "exact_duplicates": count("SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND dedup_status LIKE 'exact_duplicate%'", batch_id),
        "likely_duplicates": count("SELECT COUNT(*) FROM duplicate_candidates", ),
        "conflicts": count("SELECT COUNT(*) FROM reconciliation_findings WHERE finding_type='conflict'", ),
        "exceptions": count("SELECT COUNT(*) FROM exceptions WHERE status!='resolved'", ),
        "unknown_type_rows": count("SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND transaction_type='unknown'", batch_id),
    }

    # ---- B/C. transaction tables ----
    verified_rows, provisional_rows = [], []
    for l in conn.execute(
            """SELECT l.*, t.id AS txn_id, t.transaction_type AS tt FROM transaction_lines l
               JOIN transactions t ON t.id=l.transaction_id WHERE t.posted=1"""):
        rev = _level(conn, l["id"], l["txn_id"], CalculationType.REVENUE)
        cost = _level(conn, l["id"], l["txn_id"], CalculationType.COST)
        gp = _level(conn, l["id"], l["txn_id"], CalculationType.GROSS_PROFIT)
        entry = {
            "transaction_line_id": l["id"], "transaction_type": l["tt"],
            "description": l["description"],
            "revenue_verification": rev, "cost_verification": cost, "gross_profit_verification": gp,
        }
        if rev == "verified" and cost == "verified" and gp == "verified":
            verified_rows.append(entry)
        elif "provisional" in (rev, cost, gp):
            provisional_rows.append(entry)

    # ---- D. Where's Your Proof register ----
    register = [dict(r) for r in conn.execute(
        """SELECT id, exception_type, calculation_type, customer_ref, missing_information,
           why_critical, proof_needed, priority, status FROM exceptions WHERE status!='resolved'
           ORDER BY priority, created_at""")]

    # ---- E. Verified monthly totals ----
    verified_net_rev = totals.net_revenue.amounts["verified"]
    units = conn.execute(
        """SELECT COALESCE(SUM(quantity_minor),0) AS q FROM transaction_lines l
           JOIN transactions t ON t.id=l.transaction_id WHERE t.posted=1""").fetchone()["q"]
    e = {
        "net_revenue_verified": str(verified_net_rev.rounded()),
        "profitability_verified_gross_profit": str(pop.prof_gross_profit.rounded()),
        "verified_gross_margin_pct": pop.bridge()["verified_gross_margin_pct"],
        "verified_markup_pct": pop.bridge()["verified_markup_pct"],
        "cost_breakdown_all_posted": _cost_breakdown(conn),
        "total_actual_cost_all_posted": str(totals.total_cost.grand_total().rounded()),
        "invoice_count": count("SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND posted=1 AND transaction_type='invoice'", batch_id),
        "customer_count": count("SELECT COUNT(DISTINCT customer_id) FROM transactions WHERE posted=1 AND customer_id IS NOT NULL", ),
        "units_sold": str(quantity_from_stored(units)),
        "commission_total": str(Money.from_minor(count("SELECT COALESCE(SUM(commission_minor),0) FROM commission_calculations", )).rounded()),
    }

    # ---- F. provisional & excluded totals + bridge ----
    f = {
        "net_revenue_buckets": totals.net_revenue.to_dict(),
        "gross_profit_buckets": totals.gross_profit.to_dict(),
        "profitability_bridge": pop.bridge(),
    }

    # ---- G. reconciliation findings ----
    g = [dict(r) for r in conn.execute(
        """SELECT finding_type, rule, severity, status, expected_value, actual_value,
           difference, explanation FROM reconciliation_findings ORDER BY severity, created_at""")]

    # ---- H. deterministic analytical findings ----
    h = _analytics(conn, totals)

    # ---- I. recommended actions ----
    i = _recommend(a, h, register)

    # ---- J. database update ----
    j = {
        "transactions": count("SELECT COUNT(*) FROM transactions WHERE import_batch_id=?", batch_id),
        "snapshots_created": count("SELECT COUNT(*) FROM calculation_snapshots WHERE import_batch_id=?", batch_id),
        "exceptions_created": count("SELECT COUNT(*) FROM exceptions", ),
        "reconciliations_created": count("SELECT COUNT(*) FROM reconciliation_findings", ),
        "audit_events": count("SELECT COUNT(*) FROM audit_events", ),
    }

    # ---- K. processing status ----
    k = {
        "app_version": __version__,
        "calculation_policy": policy.key(),
        "evidence_matrix_version": "1",
        "warnings": [],
        "known_limitations": [
            "XLSX intake requires optional openpyxl (ADR-0007); untested here.",
            "Analytical findings are deterministic only (no forecasts in Exchange 2).",
        ],
        "next_operational_action": "Resolve open cost exceptions to move revenue into verified profitability.",
    }

    return {"A_intake": a, "B_verified_transactions": verified_rows,
            "C_provisional_transactions": provisional_rows, "D_wheres_your_proof": register,
            "E_verified_totals": e, "F_provisional_excluded_totals": f,
            "G_reconciliation": g, "H_analytical": h, "I_recommended_actions": i,
            "J_database_update": j, "K_processing_status": k}


_CURRENT_SNAPSHOTS = (
    "id NOT IN (SELECT superseded_snapshot_id FROM calculation_snapshots "
    "WHERE superseded_snapshot_id IS NOT NULL)")


def _analytics(conn, totals) -> dict:
    # Deterministic observations from the CURRENT (non-superseded) snapshots.
    negmargin = conn.execute(
        f"""SELECT COUNT(*) FROM calculation_snapshots WHERE calculation_name='gross_profit'
            AND {_CURRENT_SNAPSHOTS} AND output_kind='money_minor'
            AND CAST(output_value AS INTEGER) < 0""").fetchone()[0]
    freight_under = conn.execute(
        f"""SELECT COUNT(*) FROM calculation_snapshots WHERE calculation_name='freight_recovery'
            AND {_CURRENT_SNAPSHOTS} AND output_kind='money_minor'
            AND CAST(output_value AS INTEGER) < 0""").fetchone()[0]
    missing_cost = conn.execute(
        """SELECT COUNT(*) FROM record_verifications WHERE calculation_type='cost' AND level='unverified'""").fetchone()[0]
    dup_exposure = conn.execute("SELECT COUNT(*) FROM duplicate_candidates", ).fetchone()[0]
    unsupported_comm = conn.execute(
        """SELECT COUNT(*) FROM record_verifications WHERE calculation_type='commission' AND level='unverified'""").fetchone()[0]
    # customer concentration
    cust = conn.execute(
        """SELECT customer_id, COUNT(*) AS n FROM transactions WHERE posted=1 AND customer_id IS NOT NULL
           GROUP BY customer_id ORDER BY n DESC LIMIT 1""").fetchone()
    return {
        "negative_margin_lines": negmargin,
        "freight_under_recovery_lines": freight_under,
        "lines_missing_cost": missing_cost,
        "duplicate_exposure_candidates": dup_exposure,
        "unsupported_commission_lines": unsupported_comm,
        "top_customer_posted_txn_count": (cust["n"] if cust else 0),
    }


def _recommend(a, h, register) -> list:
    actions = []
    if h["lines_missing_cost"]:
        actions.append({"action": "Obtain vendor cost evidence for lines missing cost",
                        "priority": "high", "impact": "moves revenue into verified profitability",
                        "confidence": "high", "effort": "low"})
    if h["freight_under_recovery_lines"]:
        actions.append({"action": "Review freight under-recovery lines for billing correction",
                        "priority": "medium", "impact": "margin recovery", "confidence": "high",
                        "effort": "low"})
    if h["negative_margin_lines"]:
        actions.append({"action": "Investigate negative-margin transactions",
                        "priority": "high", "impact": "loss prevention", "confidence": "high",
                        "effort": "medium"})
    if a["exact_duplicates"] or h["duplicate_exposure_candidates"]:
        actions.append({"action": "Review duplicate candidates before posting",
                        "priority": "high", "impact": "prevents double-counting", "confidence": "high",
                        "effort": "low"})
    if h["unsupported_commission_lines"]:
        actions.append({"action": "Supply commission rules for unsupported commissions",
                        "priority": "medium", "impact": "commission accuracy", "confidence": "high",
                        "effort": "low"})
    return actions
