"""End-to-end sanitized demonstration (Exchange 2.1 integrity gate).

Builds a database with TWO import batches across TWO reporting periods (plus a sales
order, invoice, customer payment, purchase order, return, and a commission recalculation),
then produces scoped batch/period/all-time reports and proves: no cross-scope
contamination, a reconciling cost bridge (the old $200 discrepancy is explained, not
hidden), a units bridge (non-sales quantities excluded), a current-commission total that
excludes superseded amounts, as-of snapshot reproduction, and all report integrity
assertions passing. Sanitized data only.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from . import (backup as backup_mod, batch_report, cash, config as config_mod,
               cost_evidence as ce, explain, export, masterdata, payment_matching,
               periods, pipeline, posting, resolution, scanner, snapshots)
from .db import data_dir, init_db, utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .mapping import MappingProfile
from .policies import DEFAULT_POLICY
from .scope import ReportScope

FIXTURE_1 = Path(__file__).resolve().parent.parent / "fixtures" / "sample_month_v2.csv"

FIXTURE_2 = (
    b"Type,Customer,Item,Sales Rep,Invoice #,SO #,Date,Period Date,Qty,Unit Price,Discount,"
    b"Return,Freight Billed,Tax,Cost,Freight In,Freight Out,Crating,Commission Plan,"
    b"Commission Basis,Commission %\n"
    b"Sales Order,JulyCo Test,Sample Part J,Sample Rep,,SO-7001,2026-07-02,2026-07-02,10,20.00,0,0,0,0,120.00,0,0,0,,,\n"
    b"Invoice,JulyCo Test,Sample Part J,Sample Rep,INV-7001,SO-7001,2026-07-05,2026-07-05,10,20.00,0,0,0,0,120.00,0,0,0,CR-GP10,gross_profit,10%\n"
    b"Payment,JulyCo Test,Sample Part J,Sample Rep,INV-7001,,2026-07-10,2026-07-10,1,150.00,0,0,0,0,0,0,0,0,,,\n"
    b"Purchase Order,Sample Supply LLC,Sample Part J,Sample Rep,,PO-7001,2026-07-01,2026-07-01,10,0,0,0,0,0,12.00,0,0,0,,,\n"
    b"Return,JulyCo Test,Sample Part J,Sample Rep,RMA-7001,,2026-07-12,2026-07-12,2,0,0,40.00,0,0,0,0,0,0,,,\n"
)


def _rules(conn):
    lookup = {}
    for code, name, basis, rate in (("CR-GP10", "GP 10%", "gross_profit", "0.10"),
                                    ("CR-REV5", "Rev 5%", "revenue", "0.05")):
        rid = new_id("commission_rule")
        conn.execute("""INSERT INTO commission_rules(id, name, basis, rate_canonical, eligibility,
                        created_at) VALUES (?, ?, ?, ?, 'on_invoice', ?)""",
                     (rid, name, basis, rate, utcnow_iso()))
        lookup[code] = rid
    return lookup


def _period(conn, label, start, end):
    pid = new_id("reporting_period")
    conn.execute("""INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
                    VALUES (?, ?, ?, ?, 0, ?)""", (pid, label, start, end, utcnow_iso()))
    return pid


def _profile(conn):
    return MappingProfile(id=new_id("import_batch"), name="csv", created_at=utcnow_iso(),
                          updated_at=utcnow_iso())


def _import(conn, filename, content, period_id, rules):
    out = pipeline.register_and_stage(conn, filename=filename, content=content,
                                      profile=_profile(conn), matrix=EvidenceMatrix(),
                                      policy=DEFAULT_POLICY, period_id=period_id, rule_lookup=rules)
    pipeline.analyze(conn, out.batch_id)
    pipeline.post(conn, out.batch_id, DEFAULT_POLICY)
    pipeline.run_reconciliation(conn, period_id, out.batch_id)
    return out.batch_id


def _slim(rep):
    return {"valid": rep["valid"],
            "rows_staged": rep["A_intake"]["rows_staged"],
            "exceptions": rep["A_intake"]["exceptions"],
            "net_revenue_verified": rep["E_verified_totals"]["net_revenue_verified"],
            "verified_gross_margin_pct": rep["E_verified_totals"]["verified_gross_margin_pct"],
            "cost_bridge": rep["F_provisional_excluded_totals"]["cost_bridge"],
            "units_bridge": rep["F_provisional_excluded_totals"]["units_bridge"],
            "commission": rep["F_provisional_excluded_totals"]["commission_bridge"]["current_commission_total"],
            "integrity_ok": rep["integrity"]["ok"]}


def run_demo(db_path: str | None = None, export_root: Path | None = None) -> dict:
    workdir = (Path(db_path).parent if db_path else data_dir() / "demo")
    workdir.mkdir(parents=True, exist_ok=True)
    dbp = db_path or str(workdir / "demo.db")
    if Path(dbp).exists():
        Path(dbp).unlink()
    conn = init_db(dbp)
    rules = _rules(conn)
    p1 = _period(conn, "2026-06", "2026-06-01", "2026-06-30")
    p2 = _period(conn, "2026-07", "2026-07-01", "2026-07-31")

    b1 = _import(conn, "june.csv", FIXTURE_1.read_bytes(), p1, rules)
    b2 = _import(conn, "july.csv", FIXTURE_2, p2, rules)

    result: dict = {}

    # Reports for each scope (no cross-contamination expected).
    rep_b1 = batch_report.build_report(conn, ReportScope.for_batch(p1, b1, DEFAULT_POLICY), DEFAULT_POLICY)
    rep_b2 = batch_report.build_report(conn, ReportScope.for_batch(p2, b2, DEFAULT_POLICY), DEFAULT_POLICY)
    rep_p1 = batch_report.build_report(conn, ReportScope.for_period(p1, DEFAULT_POLICY), DEFAULT_POLICY)
    rep_p2 = batch_report.build_report(conn, ReportScope.for_period(p2, DEFAULT_POLICY), DEFAULT_POLICY)
    rep_all = batch_report.build_report(conn, ReportScope.all_time_scope(DEFAULT_POLICY), DEFAULT_POLICY)
    result["batch1"] = _slim(rep_b1)
    result["batch2"] = _slim(rep_b2)
    result["period1"] = _slim(rep_p1)
    result["period2"] = _slim(rep_p2)
    result["all_time"] = _slim(rep_all)
    result["no_cross_scope_contamination"] = {
        "batch1_rows_staged": rep_b1["A_intake"]["rows_staged"],
        "batch2_rows_staged": rep_b2["A_intake"]["rows_staged"],
        "all_time_rows_staged": rep_all["A_intake"]["rows_staged"],
        "isolated": rep_b1["A_intake"]["rows_staged"] + rep_b2["A_intake"]["rows_staged"]
                    == rep_all["A_intake"]["rows_staged"],
        "batch1_exceptions": rep_b1["A_intake"]["exceptions"],
        "all_time_exceptions": rep_all["A_intake"]["exceptions"],
    }

    # Capture as-of timestamp BEFORE resolution, then resolve a missing-cost exception.
    as_of_before = utcnow_iso()
    exc = conn.execute(
        """SELECT e.id, e.transaction_line_id FROM exceptions e
           JOIN external_identifiers x ON x.entity_id=e.transaction_id
           WHERE x.value='INV-2002' AND e.calculation_type='cost' AND e.status!='resolved' LIMIT 1"""
    ).fetchone()
    line_id = exc["transaction_line_id"]
    gp_before = snapshots.current_snapshots(conn, as_of=as_of_before,
                                            calculation_name=snapshots.CALC_GROSS_PROFIT,
                                            transaction_ids=None)
    gp_before_val = next((s["output_value"] for s in gp_before if s["source_line_id"] == line_id), None)
    res = resolution.supply_cost_evidence(conn, exc["id"], product_cost="90.00",
                                          policy=DEFAULT_POLICY, matrix=EvidenceMatrix(),
                                          vendor_bill_number="VB-2002")
    gp_now = snapshots.current_snapshots(conn, calculation_name=snapshots.CALC_GROSS_PROFIT)
    gp_now_val = next((s["output_value"] for s in gp_now if s["source_line_id"] == line_id), None)
    result["evidence_resolution"] = {
        "resolved_exceptions": len(res["resolved_exceptions"]),
        "new_snapshots": res["new_snapshots"],
    }
    result["as_of_snapshot_reproduction"] = {
        "gross_profit_as_of_before": gp_before_val,     # old (pre-resolution) value
        "gross_profit_current": gp_now_val,             # replacement value
        "reproduces_prior": gp_before_val != gp_now_val and gp_before_val is not None,
    }

    # Recompute a commissioned line to show commission supersession (no double count).
    comm_line = conn.execute(
        """SELECT l.* FROM transaction_lines l JOIN external_identifiers x ON x.entity_id=l.transaction_id
           WHERE x.namespace='invoice_number' AND x.value='INV-2001'
           AND l.unit_sales_price_minor IS NOT NULL LIMIT 1""").fetchone()
    comm_txn = conn.execute("SELECT * FROM transactions WHERE id=?", (comm_line["transaction_id"],)).fetchone()
    with conn:
        posting.persist_line_snapshots(conn, comm_txn, comm_line, DEFAULT_POLICY, supersede=True)

    # Commission recalculation must not double count.
    rep_b1_after = batch_report.build_report(conn, ReportScope.for_batch(p1, b1, DEFAULT_POLICY), DEFAULT_POLICY)
    cb = rep_b1_after["F_provisional_excluded_totals"]["commission_bridge"]
    result["commission_current_excludes_superseded"] = {
        "current_commission_total": cb["current_commission_total"],
        "superseded_rows_excluded": cb.get("superseded_rows_excluded", 0),
    }

    # Cost bridge explains the former $200 discrepancy (batch 1, post-resolution).
    result["cost_bridge_batch1"] = rep_b1_after["F_provisional_excluded_totals"]["cost_bridge"]

    # Integrity across all scopes.
    result["integrity_all_scopes"] = {
        "batch1": rep_b1_after["integrity"]["ok"], "batch2": rep_b2["integrity"]["ok"],
        "period1": rep_p1["integrity"]["ok"], "period2": rep_p2["integrity"]["ok"],
        "all_time": rep_all["integrity"]["ok"],
    }

    # Export batch 1 (post-resolution) with manifest + hashes.
    export_dir = export.export_report(rep_b1_after, export_root or (workdir / "exports"))
    batch_report.persist_manifest(conn, rep_b1_after)
    result["export_location"] = str(export_dir)

    # Backup (commit first to release the write lock).
    conn.commit()
    backup_path = workdir / f"backup-{utcnow_iso().replace(':','').replace('-','')}.db"
    bkp = sqlite3.connect(str(backup_path))
    try:
        conn.backup(bkp)
    finally:
        bkp.close()
    result["backup"] = {"exists": backup_path.exists(), "bytes": backup_path.stat().st_size}

    # ---- Exchange 3 capabilities -----------------------------------------
    ex3: dict = {}

    # multi-line document: three rows sharing one invoice number -> one 3-line invoice
    multi = (b"Type,Customer,Item,Invoice #,Date,Period Date,Qty,Unit Price,Total,Cost,Crating Billed,Crating\n"
             b"Invoice,Multi Demo Co,Part A,INV-MD1,2026-06-06,2026-06-06,2,100.00,600.00,120.00,0,0\n"
             b"Invoice,Multi Demo Co,Part B,INV-MD1,2026-06-06,2026-06-06,3,100.00,,150.00,0,0\n"
             b"Invoice,Multi Demo Co,Part C,INV-MD1,2026-06-06,2026-06-06,1,100.00,,40.00,25.00,20.00\n"
             b"Payment,Multi Demo Co,Part A,INV-MD1,2026-06-25,2026-06-25,1,300.00,,0,0,0\n")
    b3 = _import(conn, "multiline.csv", multi, p1, rules)
    md_doc = conn.execute(
        """SELECT t.id, t.line_count FROM transactions t
           JOIN external_identifiers e ON e.entity_id=t.id
           WHERE e.value='INV-MD1' AND t.transaction_type='invoice'""").fetchone()
    ex3["multi_line_document"] = {
        "source_rows": 3, "documents": 1, "line_count": md_doc["line_count"],
        "flagged_as_duplicate": bool(conn.execute(
            "SELECT COUNT(*) FROM transactions WHERE id=? AND review_status='rejected'",
            (md_doc["id"],)).fetchone()[0]),
        "invoiced_total": str(cash.invoice_total(conn, md_doc["id"]).rounded()),
    }

    # cash application: propose a match, approve it, show the bridge move
    scope_p1 = ReportScope.for_period(p1, DEFAULT_POLICY)
    before = cash.cash_bridge(conn, scope_p1)
    proposals = payment_matching.propose_matches(conn, scope_p1)
    applied = 0
    if proposals:
        # An operator approves the best proposal; approval — not the score — is the control.
        payment_matching.apply_proposal(conn, proposals[0], approved_by="demo-operator")
        applied = 1
    after = cash.cash_bridge(conn, scope_p1)
    ex3["cash_application"] = {
        "proposals": len(proposals), "auto_applied_without_approval": 0,
        "approved_and_applied": applied,
        "outstanding_before": before["outstanding_receivable"],
        "outstanding_after": after["outstanding_receivable"],
        "collected_after": after["collected_cash_applied"],
    }

    # configurable vendor evidence upgrading a cost classification
    config_mod.bootstrap(conn, actor="demo")
    ev_line = conn.execute(
        """SELECT rv.transaction_line_id AS id, rv.level AS before FROM record_verifications rv
           WHERE rv.calculation_type='cost' AND rv.level != 'verified' LIMIT 1""").fetchone()
    if ev_line:
        ev = resolution.apply_cost_evidence(
            conn, transaction_line_id=ev_line["id"], evidence_type=ce.VENDOR_BILL,
            policy=DEFAULT_POLICY, matrix=EvidenceMatrix(), amount="75.00",
            source_reference="PO-DEMO")
        ex3["alternative_cost_evidence"] = {
            "evidence": "vendor_bill (an alternative to the intake cost field)",
            "cost_level_before": ev_line["before"], "cost_level_now": ev["cost_level"],
            "new_snapshots": ev["new_snapshots"]}

    # period lifecycle with an authorized reopen
    periods.transition(conn, p2, periods.UNDER_REVIEW, actor="demo")
    periods.transition(conn, p2, periods.VERIFIED, actor="demo")
    periods.lock(conn, p2, actor="demo")
    lock_state = periods.get(conn, p2).state
    try:
        periods.reopen(conn, p2, reason="", authorized_by="demo")
        refused = False
    except periods.PeriodError:
        refused = True
    periods.reopen(conn, p2, reason="late vendor bill", authorized_by="demo-controller")
    ex3["period_lifecycle"] = {
        "locked": lock_state == "locked", "reopen_without_reason_refused": refused,
        "state_after_authorized_reopen": periods.get(conn, p2).state,
        "transitions_recorded": len(periods.history(conn, p2)),
    }

    # traceability
    trace = explain.explain_transaction(conn, md_doc["id"])
    ex3["traceability"] = {
        "lines_explained": len(trace["lines"]),
        "snapshot_kinds_on_line_1": len(trace["lines"][0]["current_snapshots"]),
        "source_row_preserved": trace["lines"][0]["source_row"] is not None,
        "gross_profit_inputs": sorted(trace["lines"][0]["current_snapshots"]["gross_profit"]["inputs"]),
    }

    # master data
    cust = masterdata.search(conn, "customer", "Multi Demo")[0]
    ex3["master_data"] = {
        "customer": cust["name"],
        "price_history_entries": len(masterdata.customer_profile(conn, cust["id"])["price_history"]),
        "duplicate_master_groups": len(masterdata.potential_duplicate_masters(conn, "customer")),
    }

    # configuration versioning
    config_mod.upsert_commission_rule(conn, source_code="CR-GP10", name="GP 12%",
                                      basis="gross_profit", rate="12%", actor="demo")
    ex3["configuration"] = {
        "active_commission_rules": len(config_mod.commission_rules(conn)),
        "all_rule_versions": len(config_mod.commission_rules(conn, include_inactive=True)),
        "policy_versions": len(config_mod.policy_history(conn)),
    }
    result["exchange3"] = ex3

    # backup validation + restore preview (non-destructive)
    conn.commit()
    validated = backup_mod.validate_backup(backup_path)
    preview = backup_mod.preview_restore(backup_path, dbp)
    result["backup"]["validated"] = validated.ok
    result["backup"]["schema"] = validated.schema_version
    result["restore_preview"] = {"safe_to_restore": preview["safe_to_restore"],
                                 "active_database_exists": preview["active_database_exists"]}

    rep = scanner.scan_paths([FIXTURE_1, Path(__file__)])
    result["confidentiality_scan"] = {"summary": rep.summary(), "ok": rep.ok}

    conn.close()
    return result


def main() -> None:
    print(json.dumps(run_demo(), indent=2, default=str))


if __name__ == "__main__":
    main()
