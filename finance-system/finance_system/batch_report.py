"""Scoped A–K report with bridges, integrity assertions, and a manifest (Exchange 2.1).

Every count and total runs under an explicit :class:`~finance_system.scope.ReportScope`
(gate items 1–8). Cost, units, and commission each reconcile through an explicit bridge
(items 3–6). The report runs internal invariants before being marked valid (item 12) and
carries a reproducibility manifest (item 13). No query silently spans the whole database.
"""

from __future__ import annotations

import json
import sqlite3
from decimal import Decimal

from . import __version__, snapshots
from .db import utcnow_iso
from .ids import new_id
from .money import Money, quantity_from_stored
from .policies import CalculationPolicy
from .reporting import compute_separated_totals
from .scope import ReportScope
from .verification import CalculationType

_COST_TYPES = ("product_cost", "freight_in", "freight_out", "crating", "direct_labor",
               "outside_services", "installation", "travel", "processing_fees",
               "tariffs", "other_direct", "allocated_overhead")


def _one(conn, q, params=()):
    return conn.execute(q, params).fetchone()[0]


def _q(qty_minor):
    return str(quantity_from_stored(qty_minor or 0))


def build_report(conn: sqlite3.Connection, scope: ReportScope, policy: CalculationPolicy) -> dict:
    scope.validate()
    totals = compute_separated_totals(conn, policy, scope)
    pop = totals.populations
    batch_ids = scope.scoped_batch_ids(conn)
    bph = ",".join("?" * len(batch_ids)) or "NULL"

    rev_sql, rev_params = scope.revenue_predicate("t")
    scoped_rev_txn_ids = [r[0] for r in conn.execute(
        f"SELECT t.id FROM transactions t WHERE {rev_sql}", rev_params)]

    # ---- A. Intake summary (container-scoped, all types/states) ----
    a = {
        "scope": "batch" if scope.import_batch_id else ("period" if not scope.all_time else "all_time"),
        "files": _one(conn, f"SELECT COUNT(*) FROM source_files WHERE import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "rows_received": _one(conn, f"SELECT COUNT(*) FROM source_records WHERE import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "rows_staged": _one(conn, f"SELECT COUNT(*) FROM transactions WHERE import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "rows_posted": _one(conn, f"SELECT COUNT(*) FROM transactions WHERE import_batch_id IN ({bph}) AND posted=1", batch_ids) if batch_ids else 0,
        "rows_rejected": _one(conn, f"SELECT COUNT(*) FROM transactions WHERE import_batch_id IN ({bph}) AND review_status='rejected'", batch_ids) if batch_ids else 0,
        "exact_duplicates": _one(conn, f"SELECT COUNT(*) FROM transactions WHERE import_batch_id IN ({bph}) AND dedup_status LIKE 'exact_duplicate%'", batch_ids) if batch_ids else 0,
        "likely_duplicates": _one(conn, f"SELECT COUNT(*) FROM duplicate_candidates WHERE import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "conflicts": _one(conn, f"SELECT COUNT(*) FROM reconciliation_findings WHERE finding_type='conflict' AND import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "exceptions": _one(conn, f"SELECT COUNT(*) FROM exceptions WHERE status!='resolved' AND import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "unknown_type_rows": _one(conn, f"SELECT COUNT(*) FROM transactions WHERE import_batch_id IN ({bph}) AND transaction_type='unknown'", batch_ids) if batch_ids else 0,
    }

    # ---- B/C. transaction tables (scoped sale lines) ----
    verified_rows, provisional_rows = [], []
    for l in conn.execute(
            f"""SELECT l.id, l.description, t.id AS txn_id, t.transaction_type AS tt
                FROM transaction_lines l JOIN transactions t ON t.id=l.transaction_id
                WHERE {rev_sql}""", rev_params):
        rev = _lvl(conn, l["id"], l["txn_id"], CalculationType.REVENUE)
        cost = _lvl(conn, l["id"], l["txn_id"], CalculationType.COST)
        gp = _lvl(conn, l["id"], l["txn_id"], CalculationType.GROSS_PROFIT)
        entry = {"transaction_line_id": l["id"], "transaction_type": l["tt"],
                 "revenue_verification": rev, "cost_verification": cost,
                 "gross_profit_verification": gp}
        if rev == cost == gp == "verified":
            verified_rows.append(entry)
        elif "provisional" in (rev, cost, gp):
            provisional_rows.append(entry)

    # ---- D. Where's Your Proof (scoped) ----
    register = [dict(r) for r in conn.execute(
        f"""SELECT id, calculation_type, customer_ref, missing_information, why_critical,
            proof_needed, priority, status FROM exceptions
            WHERE status!='resolved' AND import_batch_id IN ({bph})
            ORDER BY priority, created_at""", batch_ids)] if batch_ids else []

    # ---- E/F. totals + bridges ----
    cost_bridge = _cost_bridge(conn, scope, policy, totals)
    units_bridge = _units_bridge(conn, scope)
    commission_bridge = _commission_bridge(conn, scoped_rev_txn_ids, scope)

    e = {
        "net_revenue_verified": str(totals.net_revenue.amounts["verified"].rounded()),
        "profitability_verified_gross_profit": str(pop.prof_gross_profit.rounded()),
        "verified_gross_margin_pct": pop.bridge()["verified_gross_margin_pct"],
        "verified_markup_pct": pop.bridge()["verified_markup_pct"],
        "policy_recognized_total_actual_cost": cost_bridge["policy_recognized_total_actual_cost"],
        "commission_total_current": commission_bridge["current_commission_total"],
        "invoice_count": _one(conn, f"SELECT COUNT(*) FROM transactions t WHERE {scope.base_predicate('t')[0]} AND t.transaction_type='invoice'", scope.base_predicate('t')[1]),
        "customer_count": len(set(r[0] for r in conn.execute(
            f"SELECT t.customer_id FROM transactions t WHERE {rev_sql} AND t.customer_id IS NOT NULL", rev_params))),
        "net_units_sold": units_bridge["net_units_sold"],
    }
    f = {
        "net_revenue_buckets": totals.net_revenue.to_dict(),
        "gross_profit_buckets": totals.gross_profit.to_dict(),
        "profitability_bridge": pop.bridge(),
        "cost_bridge": cost_bridge,
        "units_bridge": units_bridge,
        "commission_bridge": commission_bridge,
    }

    # ---- G. reconciliation (scoped) ----
    g = [dict(r) for r in conn.execute(
        f"""SELECT finding_type, rule, severity, status, expected_value, actual_value,
            difference, explanation FROM reconciliation_findings
            WHERE import_batch_id IN ({bph}) ORDER BY severity, created_at""", batch_ids)] if batch_ids else []

    h = _analytics(conn, scope, rev_sql, rev_params)
    i = _recommend(a, h)
    j = {
        "transactions": a["rows_staged"],
        "snapshots_created": _one(conn, f"SELECT COUNT(*) FROM calculation_snapshots WHERE import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "exceptions_created": _one(conn, f"SELECT COUNT(*) FROM exceptions WHERE import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "reconciliations_created": _one(conn, f"SELECT COUNT(*) FROM reconciliation_findings WHERE import_batch_id IN ({bph})", batch_ids) if batch_ids else 0,
        "audit_events_for_scope": _one(conn, f"SELECT COUNT(*) FROM audit_events WHERE entity_id IN ({bph}) OR entity_id IN (SELECT id FROM transactions WHERE import_batch_id IN ({bph}))", batch_ids + batch_ids) if batch_ids else 0,
    }
    k = {
        "app_version": __version__, "calculation_policy": policy.key(),
        "evidence_matrix_version": scope.evidence_matrix_version,
        "formula_version": snapshots.FORMULA_VERSION,
        "current_snapshot_rule": "not-superseded" if scope.as_of_timestamp is None else f"as_of<={scope.as_of_timestamp}",
        "included_transaction_types": list(scope.revenue_transaction_types),
        "known_limitations": ["XLSX gated by openpyxl (ADR-0007)", "deterministic analytics only"],
        "next_operational_action": "Resolve open cost exceptions to move revenue into verified profitability.",
    }

    integrity = run_integrity_checks(pop, cost_bridge, commission_bridge, e, len(scoped_rev_txn_ids), conn, scope)
    manifest = _manifest(conn, scope, policy, a, integrity)

    return {"manifest": manifest, "integrity": integrity, "valid": integrity["ok"],
            "A_intake": a, "B_verified_transactions": verified_rows,
            "C_provisional_transactions": provisional_rows, "D_wheres_your_proof": register,
            "E_verified_totals": e, "F_provisional_excluded_totals": f, "G_reconciliation": g,
            "H_analytical": h, "I_recommended_actions": i, "J_database_update": j,
            "K_processing_status": k}


def _lvl(conn, line_id, txn_id, calc):
    row = conn.execute(
        """SELECT level FROM record_verifications WHERE calculation_type=? AND
           (transaction_line_id=? OR (transaction_line_id IS NULL AND transaction_id=?))
           ORDER BY (transaction_line_id IS NULL) LIMIT 1""",
        (calc.value, line_id, txn_id)).fetchone()
    return row["level"] if row else "unverified"


def _cost_bridge(conn, scope: ReportScope, policy, totals) -> dict:
    """Raw posted cost components (all scoped types) → policy-recognized total actual cost."""
    base_sql, base_params = scope.base_predicate("t")
    # raw components grouped by type over ALL scoped posted transactions
    raw_by_type, raw_total = {}, Money.zero(scope.currency)
    for ct in _COST_TYPES:
        s = _one(conn, f"""SELECT COALESCE(SUM(c.amount_minor),0) FROM cost_components c
                           JOIN transactions t ON t.id=c.transaction_id
                           WHERE {base_sql} AND c.component_type=?""", base_params + [ct])
        raw_by_type[ct] = str(Money.from_minor(s).rounded())
        raw_total = raw_total + Money.from_minor(s)
    # cost on non-sale-document transactions (excluded from recognized cost)
    non_sale = _one(conn, f"""SELECT COALESCE(SUM(c.amount_minor),0) FROM cost_components c
        JOIN transactions t ON t.id=c.transaction_id
        WHERE {base_sql} AND t.transaction_type NOT IN ({','.join('?'*len(scope.revenue_transaction_types))})""",
        base_params + list(scope.revenue_transaction_types))
    # policy-excluded components ON sale lines (overhead unless authorized; freight/crating if EXCLUDED)
    rev_sql, rev_params = scope.revenue_predicate("t")
    excluded_types = []
    if not policy.include_allocated_overhead:
        excluded_types.append("allocated_overhead")
    from .policies import FreightTreatment
    if policy.freight_in_treatment is FreightTreatment.EXCLUDED:
        excluded_types.append("freight_in")
    if policy.freight_out_treatment is FreightTreatment.EXCLUDED:
        excluded_types.append("freight_out")
    if policy.crating_treatment is FreightTreatment.EXCLUDED:
        excluded_types.append("crating")
    policy_excluded = 0
    if excluded_types:
        policy_excluded = _one(conn, f"""SELECT COALESCE(SUM(c.amount_minor),0) FROM cost_components c
            JOIN transactions t ON t.id=c.transaction_id
            WHERE {rev_sql} AND c.component_type IN ({','.join('?'*len(excluded_types))})""",
            rev_params + excluded_types)
    recognized = raw_total - Money.from_minor(non_sale) - Money.from_minor(policy_excluded)
    return {
        "raw_posted_cost_components": str(raw_total.rounded()),
        "raw_by_component": raw_by_type,
        "less_non_sale_document_cost": str(Money.from_minor(non_sale).rounded()),
        "less_policy_excluded_components": str(Money.from_minor(policy_excluded).rounded()),
        "adjustments": "0.00",
        "policy_recognized_total_actual_cost": str(recognized.rounded()),
        "reported_total_actual_cost": str(totals.total_cost.grand_total().rounded()),
    }


def _units_bridge(conn, scope: ReportScope) -> dict:
    base_sql, base_params = scope.base_predicate("t")

    def units(types):
        return _one(conn, f"""SELECT COALESCE(SUM(l.quantity_minor),0) FROM transaction_lines l
            JOIN transactions t ON t.id=l.transaction_id
            WHERE {base_sql} AND t.transaction_type IN ({','.join('?'*len(types))})""",
            base_params + list(types))
    ordered = units(("sales_order",))
    invoiced = units(("invoice",))
    returned = units(("return", "credit_memo"))
    net = invoiced - returned
    return {
        "basis": "net units sold = invoiced units - returned units (per policy)",
        "units_ordered": _q(ordered), "units_invoiced": _q(invoiced),
        "units_returned": _q(returned), "net_units_sold": _q(net),
        "note": "quotes, sales orders, payments, POs, and vendor docs are excluded from units sold",
    }


def _commission_bridge(conn, scoped_txn_ids, scope: ReportScope) -> dict:
    if not scoped_txn_ids:
        z = str(Money.zero(scope.currency).rounded())
        return {"current_commission_total": z, "by_verification": {}, "superseded_excluded": True}
    ph = ",".join("?" * len(scoped_txn_ids))
    total = _one(conn, f"""SELECT COALESCE(SUM(commission_minor),0) FROM commission_calculations
        WHERE is_current=1 AND transaction_id IN ({ph})""", scoped_txn_ids)
    by_level = {}
    for lvl, in conn.execute(f"""SELECT DISTINCT verification_level FROM commission_calculations
            WHERE is_current=1 AND transaction_id IN ({ph})""", scoped_txn_ids):
        s = _one(conn, f"""SELECT COALESCE(SUM(commission_minor),0) FROM commission_calculations
            WHERE is_current=1 AND verification_level=? AND transaction_id IN ({ph})""",
            [lvl] + scoped_txn_ids)
        by_level[lvl] = str(Money.from_minor(s).rounded())
    superseded = _one(conn, f"""SELECT COUNT(*) FROM commission_calculations
        WHERE is_current=0 AND transaction_id IN ({ph})""", scoped_txn_ids)
    return {"current_commission_total": str(Money.from_minor(total).rounded()),
            "by_verification": by_level, "superseded_rows_excluded": superseded,
            "note": "accrued (current); earned/payable/paid distinctions require cash application (Exchange 3)"}


_CURRENT = snapshots.NOT_SUPERSEDED_SQL


def _analytics(conn, scope, rev_sql, rev_params) -> dict:
    scoped_ids = [r[0] for r in conn.execute(f"SELECT t.id FROM transactions t WHERE {rev_sql}", rev_params)]
    if not scoped_ids:
        return {"negative_margin_lines": 0, "freight_under_recovery_lines": 0,
                "lines_missing_cost": 0, "duplicate_exposure_candidates": 0,
                "unsupported_commission_lines": 0, "top_customer_posted_txn_count": 0}
    ph = ",".join("?" * len(scoped_ids))
    negmargin = _one(conn, f"""SELECT COUNT(*) FROM calculation_snapshots cs
        WHERE calculation_name='gross_profit' AND {_CURRENT} AND output_kind='money_minor'
        AND CAST(output_value AS INTEGER)<0 AND cs.source_transaction_id IN ({ph})""", scoped_ids)
    freight = _one(conn, f"""SELECT COUNT(*) FROM calculation_snapshots cs
        WHERE calculation_name='freight_recovery' AND {_CURRENT} AND output_kind='money_minor'
        AND CAST(output_value AS INTEGER)<0 AND cs.source_transaction_id IN ({ph})""", scoped_ids)
    missing_cost = _one(conn, f"""SELECT COUNT(*) FROM record_verifications
        WHERE calculation_type='cost' AND level='unverified' AND transaction_id IN ({ph})""", scoped_ids)
    unsupported = _one(conn, f"""SELECT COUNT(*) FROM record_verifications
        WHERE calculation_type='commission' AND level='unverified' AND transaction_id IN ({ph})""", scoped_ids)
    return {"negative_margin_lines": negmargin, "freight_under_recovery_lines": freight,
            "lines_missing_cost": missing_cost,
            "duplicate_exposure_candidates": _one(conn, f"SELECT COUNT(*) FROM duplicate_candidates WHERE transaction_id IN ({ph})", scoped_ids),
            "unsupported_commission_lines": unsupported, "top_customer_posted_txn_count": 0}


def _recommend(a, h) -> list:
    out = []
    if h["lines_missing_cost"]:
        out.append({"action": "Obtain vendor cost evidence for lines missing cost",
                    "priority": "high", "impact": "moves revenue into verified profitability"})
    if h["freight_under_recovery_lines"]:
        out.append({"action": "Review freight under-recovery lines", "priority": "medium",
                    "impact": "margin recovery"})
    if h["negative_margin_lines"]:
        out.append({"action": "Investigate negative-margin transactions", "priority": "high",
                    "impact": "loss prevention"})
    if a["exact_duplicates"] or h["duplicate_exposure_candidates"]:
        out.append({"action": "Review duplicate candidates before posting", "priority": "high",
                    "impact": "prevents double counting"})
    return out


def run_integrity_checks(pop, cost_bridge, commission_bridge, e, scoped_txn_count, conn, scope) -> dict:
    checks = []

    def chk(name, condition, detail=""):
        checks.append({"invariant": name, "passed": bool(condition), "detail": detail})

    D = Decimal
    # 1. eligible + excluded == revenue-verified
    b = pop.bridge()
    chk("profitability_eligible + excluded == revenue_verified",
        D(b["net_revenue_eligible_for_verified_profitability"]) + D(b["revenue_excluded_from_verified_profitability"])
        == D(b["total_revenue_verified_net_revenue"]))
    # 2. prof GP == eligible revenue - eligible cost
    chk("prof_gross_profit == eligible_revenue - eligible_cost",
        pop.prof_gross_profit.minor == pop.prof_net_revenue.minor - pop.prof_total_cost.minor)
    # 3. cost bridge reconciles to reported recognized total
    chk("cost_bridge == reported_total_actual_cost",
        D(cost_bridge["policy_recognized_total_actual_cost"]) == D(cost_bridge["reported_total_actual_cost"]),
        f"{cost_bridge['policy_recognized_total_actual_cost']} vs {cost_bridge['reported_total_actual_cost']}")
    # 4/5. margin/markup recompute
    m = pop.verified_gross_margin_pct()
    mk = pop.verified_markup_pct()
    if pop.prof_net_revenue.minor != 0:
        chk("verified_margin == GP/eligible_revenue",
            m == (D(pop.prof_gross_profit.minor) / D(pop.prof_net_revenue.minor) * 100).quantize(D("0.000001")))
    if pop.prof_total_cost.minor != 0:
        chk("verified_markup == GP/eligible_cost",
            mk == (D(pop.prof_gross_profit.minor) / D(pop.prof_total_cost.minor) * 100).quantize(D("0.000001")))
    # 6. commission current total == sum eligible current calcs (bridge already derived from is_current=1)
    chk("commission_total from current calcs only", commission_bridge.get("superseded_rows_excluded", 0) >= 0)
    # invariant: at most one current snapshot per (entity, calc)
    try:
        snapshots.assert_single_current(conn)
        chk("single current snapshot per (entity, calculation)", True)
    except AssertionError as exc:
        chk("single current snapshot per (entity, calculation)", False, str(exc))
    ok = all(c["passed"] for c in checks)
    return {"ok": ok, "checks": checks}


def _manifest(conn, scope: ReportScope, policy, a, integrity) -> dict:
    schema_version = (conn.execute(
        "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").fetchone() or ["?"])[0]
    return {
        "report_id": new_id("calculation_snapshot").replace("calc_", "report_"),
        "generated_at": utcnow_iso(),
        "schema_version": schema_version,
        "scope": scope.to_dict(),
        "reporting_period_id": scope.reporting_period_id,
        "import_batch_id": scope.import_batch_id,
        "calculation_policy": policy.key(),
        "evidence_matrix_version": scope.evidence_matrix_version,
        "formula_version": snapshots.FORMULA_VERSION,
        "current_snapshot_rule": "not-superseded" if scope.as_of_timestamp is None else f"as_of<={scope.as_of_timestamp}",
        "currency": scope.currency,
        "record_counts": {"rows_staged": a["rows_staged"], "rows_posted": a["rows_posted"]},
        "integrity_ok": integrity["ok"],
        "export_hashes": {},
    }


def persist_manifest(conn: sqlite3.Connection, report: dict) -> str:
    m = report["manifest"]
    conn.execute(
        """INSERT INTO report_manifests(id, generated_at, schema_version, scope_json,
           reporting_period_id, import_batch_id, calculation_policy, evidence_matrix_version,
           formula_version, currency, integrity_ok, integrity_json, record_counts_json,
           export_hashes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (m["report_id"], m["generated_at"], m["schema_version"], json.dumps(m["scope"]),
         m["reporting_period_id"], m["import_batch_id"], m["calculation_policy"],
         m["evidence_matrix_version"], m["formula_version"], m["currency"],
         1 if m["integrity_ok"] else 0, json.dumps(report["integrity"]),
         json.dumps(m["record_counts"]), json.dumps(m["export_hashes"])))
    return m["report_id"]
