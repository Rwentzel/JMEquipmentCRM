"""End-to-end sanitized monthly-close demonstration (Exchange 2 required demo).

Runs the full workflow on sanitized fixtures: initialize -> import -> map -> stage ->
detect exact/likely duplicates and conflicts -> classify -> review -> post (with snapshot
persistence) -> exceptions -> reconcile -> A–K report -> export -> resolve a missing-cost
exception -> recalculate -> show preserved snapshot history and updated profitability ->
idempotent re-import + duplicate-post prevention -> period lock + prohibited-post refusal
-> backup -> confidentiality scan.

Sanitized data only. No real business values.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from . import batch_report, export, pipeline, reconcile, resolution, scanner, snapshots
from .db import data_dir, init_db, utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .mapping import MappingProfile
from .money import Money
from .policies import DEFAULT_POLICY
from .verification import CalculationType

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "sample_month_v2.csv"


def _seed_rules(conn) -> dict:
    lookup = {}
    for code, name, basis, rate in (
        ("CR-GP10", "Standard 10% of gross profit", "gross_profit", "0.10"),
        ("CR-REV5", "Revenue 5%", "revenue", "0.05"),
    ):
        rid = new_id("commission_rule")
        conn.execute(
            """INSERT INTO commission_rules(id, name, basis, rate_canonical, eligibility,
               created_at) VALUES (?, ?, ?, ?, 'on_invoice', ?)""",
            (rid, name, basis, rate, utcnow_iso()))
        lookup[code] = rid
    return lookup


def _make_period(conn, label, start, end, locked=0) -> str:
    pid = new_id("reporting_period")
    conn.execute(
        """INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""", (pid, label, start, end, locked, utcnow_iso()))
    return pid


def run_demo(db_path: str | None = None, export_root: Path | None = None) -> dict:
    workdir = (Path(db_path).parent if db_path else data_dir() / "demo")
    workdir.mkdir(parents=True, exist_ok=True)
    dbp = db_path or str(workdir / "demo.db")
    if Path(dbp).exists():
        Path(dbp).unlink()
    conn = init_db(dbp)                                            # 1. initialize clean DB
    matrix = EvidenceMatrix()
    policy = DEFAULT_POLICY
    profile = MappingProfile(id=new_id("import_batch"), name="default-csv", created_at=utcnow_iso(),
                             updated_at=utcnow_iso())
    rule_lookup = _seed_rules(conn)
    period_id = _make_period(conn, "2026-06", "2026-06-01", "2026-06-30")
    result: dict = {"steps": []}

    # 2–8. register + parse + map + stage + analyze (dups/conflicts) + review
    out = pipeline.register_and_stage(
        conn, filename="sample_month_v2.csv", content=FIXTURE.read_bytes(),
        profile=profile, matrix=matrix, policy=policy, period_id=period_id,
        rule_lookup=rule_lookup, label="june-close")
    analysis = pipeline.analyze(conn, out.batch_id)
    review = pipeline.review_summary(conn, out.batch_id)
    result["import"] = {"rows_received": out.rows_received, "rows_staged": out.rows_staged,
                        "mapping_confidence": out.mapping["confidence"],
                        "unmapped_headers": out.mapping["unmapped_headers"]}
    result["analysis"] = {"exact_duplicates": len(analysis.exact_duplicates),
                          "likely_duplicates": analysis.likely_duplicates,
                          "conflicts": analysis.conflicts}
    result["review_summary"] = review

    # 9–11. post approved rows (persists snapshots; staging created exceptions)
    posted = pipeline.post(conn, out.batch_id, policy)
    result["post"] = posted

    # 12. reconciliation
    result["reconciliations_created"] = pipeline.run_reconciliation(conn, period_id)

    # 13. A–K report (pre-resolution)
    report_before = batch_report.build_report(conn, out.batch_id, policy, period_id)
    result["report_before"] = {
        "verified_totals": report_before["E_verified_totals"],
        "profitability_bridge": report_before["F_provisional_excluded_totals"]["profitability_bridge"],
        "open_exceptions": len(report_before["D_wheres_your_proof"]),
    }

    # 14. export the package
    export_dir = export.export_report(report_before, export_root or (workdir / "exports"))
    result["export_location"] = str(export_dir)

    # 15–18. resolve a missing-cost exception, recompute, show preserved history + updated totals
    exc = conn.execute(
        """SELECT e.id, e.transaction_id, e.transaction_line_id FROM exceptions e
           JOIN external_identifiers x ON x.entity_id=e.transaction_id
           WHERE x.namespace='invoice_number' AND x.value='INV-2002'
           AND e.calculation_type='cost' AND e.status!='resolved' LIMIT 1""").fetchone()
    if exc:
        line_id = exc["transaction_line_id"]
        gp_hist_before = len(snapshots.history(conn, "transaction_line", line_id, snapshots.CALC_GROSS_PROFIT))
        res = resolution.supply_cost_evidence(
            conn, exc["id"], product_cost="90.00", policy=policy, matrix=matrix,
            vendor_bill_number="VB-2002", evidence_ref="vendor-bill-VB-2002")
        gp_hist_after = len(snapshots.history(conn, "transaction_line", line_id, snapshots.CALC_GROSS_PROFIT))
        result["resolution"] = {
            "resolved_exceptions": len(res["resolved_exceptions"]),
            "new_snapshots": res["new_snapshots"],
            "gross_profit_snapshot_history": {"before": gp_hist_before, "after": gp_hist_after},
            "prior_snapshots_preserved": gp_hist_after > gp_hist_before,
        }
    report_after = batch_report.build_report(conn, out.batch_id, policy, period_id)
    result["report_after"] = {
        "verified_totals": report_after["E_verified_totals"],
        "profitability_bridge": report_after["F_provisional_excluded_totals"]["profitability_bridge"],
        "open_exceptions": len(report_after["D_wheres_your_proof"]),
    }

    # 19–20. idempotent re-import + duplicate-post prevention
    out2 = pipeline.register_and_stage(
        conn, filename="sample_month_v2.csv", content=FIXTURE.read_bytes(),
        profile=profile, matrix=matrix, policy=policy, period_id=period_id,
        rule_lookup=rule_lookup, label="june-close-reimport")
    analysis2 = pipeline.analyze(conn, out2.batch_id)
    posted2 = pipeline.post(conn, out2.batch_id, policy)
    rejected2 = conn.execute(
        "SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND review_status='rejected'",
        (out2.batch_id,)).fetchone()[0]
    result["idempotent_reimport"] = {
        "duplicate_file_flagged": out2.is_duplicate_file,
        "exact_duplicates_detected": len(analysis2.exact_duplicates),
        "rows_rejected_as_duplicate": rejected2,
        "rows_posted_second_time": posted2["posted_transactions"],
    }

    # 21–23. lock period + attempt prohibited post
    conn.execute("UPDATE reporting_periods SET locked=1 WHERE id=?", (period_id,))
    out3 = pipeline.register_and_stage(
        conn, filename="late.csv",
        content=b"Type,Customer,Item,Invoice #,Date,Period Date,Qty,Unit Price,Cost\n"
                b"Invoice,Latecomer Test Co,Sample Late J,INV-9999,2026-06-25,2026-06-25,1,10.00,5.00\n",
        profile=profile, matrix=matrix, policy=policy, period_id=period_id, rule_lookup=rule_lookup,
        label="late-post")
    try:
        pipeline.post(conn, out3.batch_id, policy)
        lock_enforced = False
        lock_msg = "ERROR: locked-period post was NOT refused"
    except ValueError as e:
        lock_enforced = True
        lock_msg = str(e)
    result["period_lock"] = {"enforced": lock_enforced, "message": lock_msg}

    # 24. backup (commit first: a pending write transaction would block the backup)
    conn.commit()
    backup_path = workdir / f"backup-{utcnow_iso().replace(':','').replace('-','')}.db"
    bkp = sqlite3.connect(str(backup_path))
    try:
        conn.backup(bkp)
    finally:
        bkp.close()
    result["backup"] = {"path": str(backup_path), "exists": backup_path.exists(),
                        "bytes": backup_path.stat().st_size}

    # 25. confidentiality scan of fixtures + repo package
    rep = scanner.scan_paths([FIXTURE, Path(__file__)])
    result["confidentiality_scan"] = {"summary": rep.summary(), "ok": rep.ok}

    conn.close()
    return result


def main() -> None:
    print(json.dumps(run_demo(), indent=2, default=str))


if __name__ == "__main__":
    main()
