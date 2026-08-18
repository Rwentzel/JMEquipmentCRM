"""Command-line workflow for the monthly close (§14, scoped per Exchange 2.1).

Operates on the private local database (default: gitignored .data/finance.db). Commands
return meaningful exit codes, avoid printing raw customer PII, support dry runs, refuse
posting into a locked period or exact-duplicate posting without an override, and **close
their database connection** (no leaked handles). Report/export run under an explicit
ReportScope and return a non-zero exit code when report integrity assertions fail.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

from . import backup as backup_mod, batch_report, cash, cost_evidence as ce, explain, export as export_mod, config as config_mod, imports, masterdata, payment_matching, periods as periods_mod, pipeline, resolution, scanner
from .db import default_db_path, init_db, utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .mapping import MappingProfile
from .policies import DEFAULT_POLICY
from .scope import ReportScope

EXIT_OK, EXIT_ERROR, EXIT_REFUSED, EXIT_INTEGRITY = 0, 1, 2, 3


def _profile() -> MappingProfile:
    return MappingProfile(id=new_id("import_batch"), name="default-csv",
                          created_at=utcnow_iso(), updated_at=utcnow_iso())


def _period_id(conn, label: str | None):
    if not label:
        r = conn.execute("SELECT id FROM reporting_periods ORDER BY created_at DESC LIMIT 1").fetchone()
        return r["id"] if r else None
    r = conn.execute("SELECT id FROM reporting_periods WHERE label=?", (label,)).fetchone()
    if r:
        return r["id"]
    pid = new_id("reporting_period")
    y, m = label.split("-")
    conn.execute(
        """INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
           VALUES (?, ?, ?, ?, 0, ?)""",
        (pid, label, f"{y}-{m}-01", f"{y}-{m}-28", utcnow_iso()))
    conn.commit()
    return pid


def _latest_batch(conn):
    r = conn.execute("SELECT id FROM import_batches ORDER BY created_at DESC LIMIT 1").fetchone()
    return r["id"] if r else None


def _scope(conn, args):
    """Build a ReportScope from CLI args (batch takes precedence, else period, else all-time)."""
    period_id = _period_id(conn, getattr(args, "period", None))
    batch = getattr(args, "batch", None)
    if batch:
        if not period_id:
            # Batch reports require a period; derive it from the batch rather than crashing.
            row = conn.execute(
                """SELECT reporting_period_id FROM transactions WHERE import_batch_id=?
                   AND reporting_period_id IS NOT NULL LIMIT 1""", (batch,)).fetchone()
            period_id = row["reporting_period_id"] if row else None
        if not period_id:
            raise ValueError(
                f"batch {batch} has no reporting period; pass --period YYYY-MM explicitly")
        return ReportScope.for_batch(period_id, batch, DEFAULT_POLICY)
    if getattr(args, "all_time", False) or not period_id:
        return ReportScope.all_time_scope(DEFAULT_POLICY)
    return ReportScope.for_period(period_id, DEFAULT_POLICY)


def cmd_initialize(args, conn) -> int:
    table_count = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    print(f"[init] database ready at: {args.db or default_db_path()}")
    print(f"[init] schema migrations applied; tables: {table_count}")
    return EXIT_OK


def cmd_import(args, conn) -> int:
    path = Path(args.file)
    if not path.is_file():
        print(f"[import] file not found: {path}", file=sys.stderr)
        return EXIT_ERROR
    period_id = _period_id(conn, args.period)
    out = pipeline.register_and_stage(
        conn, filename=path.name, content=path.read_bytes(), profile=_profile(),
        matrix=EvidenceMatrix(), policy=DEFAULT_POLICY, period_id=period_id, label=path.name)
    analysis = pipeline.analyze(conn, out.batch_id, allow_duplicates=args.allow_duplicates,
                                override_reason="cli --allow-duplicates")
    conn.commit()
    print(f"[import] batch {out.batch_id}")
    print(f"[import] active db: {args.db or default_db_path()}")
    print(f"[import] rows received={out.rows_received} staged={out.rows_staged} "
          f"row_errors={out.row_errors} duplicate_file={out.is_duplicate_file}")
    print(f"[import] exact_duplicates={len(analysis.exact_duplicates)} "
          f"likely_duplicates={analysis.likely_duplicates} conflicts={analysis.conflicts}")
    print(f"[import] review: {json.dumps(pipeline.review_summary(conn, out.batch_id))}")
    if args.dry_run:
        imports.rollback_batch(conn, out.batch_id); conn.commit()
        print("[import] --dry-run: staged rows rolled back (nothing posted).")
        return EXIT_OK
    if args.post:
        try:
            res = pipeline.post(conn, out.batch_id, DEFAULT_POLICY)
        except ValueError as e:
            print(f"[import] POST REFUSED: {e}", file=sys.stderr)
            return EXIT_REFUSED
        conn.commit()
        print(f"[import] posted: {json.dumps(res)}")
    return EXIT_OK


def cmd_review(args, conn) -> int:
    print(json.dumps(pipeline.review_summary(conn, args.batch_id), indent=2))
    return EXIT_OK


def cmd_post(args, conn) -> int:
    try:
        res = pipeline.post(conn, args.batch_id, DEFAULT_POLICY)
    except ValueError as e:
        print(f"[post] REFUSED: {e}", file=sys.stderr)
        return EXIT_REFUSED
    conn.commit()
    print(f"[post] {json.dumps(res)}")
    return EXIT_OK


def cmd_rollback(args, conn) -> int:
    try:
        imports.rollback_batch(conn, args.batch_id)
    except ValueError as e:
        print(f"[rollback] REFUSED: {e}", file=sys.stderr)
        return EXIT_REFUSED
    conn.commit()
    print(f"[rollback] batch {args.batch_id} rolled back.")
    return EXIT_OK


def cmd_exceptions(args, conn) -> int:
    rows = conn.execute(
        """SELECT id, calculation_type, priority, missing_information FROM exceptions
           WHERE status!='resolved' ORDER BY priority, created_at""").fetchall()
    print(f"[exceptions] {len(rows)} open")
    for r in rows:
        print(f"  {r['id']}  {r['calculation_type']:14} {r['priority']:6} {r['missing_information']}")
    return EXIT_OK


def cmd_resolve(args, conn) -> int:
    try:
        res = resolution.supply_cost_evidence(
            conn, args.exception_id, product_cost=args.product_cost, policy=DEFAULT_POLICY,
            matrix=EvidenceMatrix(), vendor_bill_number=args.vendor_bill, evidence_ref=args.evidence_ref)
    except KeyError as e:
        print(f"[resolve] {e}", file=sys.stderr)
        return EXIT_ERROR
    conn.commit()
    print(f"[resolve] {json.dumps(res)}")
    return EXIT_OK


def cmd_config(args, conn) -> int:
    """Show or change controlled configuration (versioned; history is never edited)."""
    config_mod.bootstrap(conn, actor="cli")
    if args.action == "show":
        print(json.dumps({
            "settings": config_mod.all_settings(conn),
            "commission_rules_active": config_mod.commission_rules(conn),
            "policy_versions": config_mod.policy_history(conn),
            "mapping_profiles": config_mod.mapping_profiles(conn),
            "evidence_acceptance": config_mod.evidence_acceptance(conn, DEFAULT_POLICY.key()),
        }, indent=2, default=str))
        return EXIT_OK
    try:
        if args.action == "set":
            config_mod.set_setting(conn, args.key, args.value, actor="cli")
            print(f"[config] {args.key} = {args.value}")
        elif args.action == "rule":
            config_mod.upsert_commission_rule(
                conn, source_code=args.key, name=args.name or args.key,
                basis=args.basis or "gross_profit", rate=args.value, actor="cli")
            print(f"[config] commission rule {args.key} saved as a new version")
        elif args.action == "evidence":
            config_mod.set_evidence_acceptance(conn, DEFAULT_POLICY.key(), args.key,
                                               args.value, actor="cli")
            print(f"[config] evidence {args.key} now satisfies '{args.value}'")
    except (KeyError, ValueError) as e:
        print(f"[config] REFUSED: {e}", file=sys.stderr)
        return EXIT_ERROR
    conn.commit()
    return EXIT_OK


def cmd_master(args, conn) -> int:
    """Look up customers / vendors / products, with history."""
    if args.id:
        fn = {"customer": masterdata.customer_profile, "vendor": masterdata.vendor_profile,
              "product": masterdata.product_profile}[args.kind]
        try:
            print(json.dumps(fn(conn, args.id), indent=2, default=str))
        except KeyError as e:
            print(f"[master] {e}", file=sys.stderr)
            return EXIT_ERROR
        return EXIT_OK
    hits = masterdata.search(conn, args.kind, args.query or "")
    print(f"[master] {len(hits)} {args.kind}(s)")
    for h in hits:
        print(f"  {h['id']}  {h['name']}")
    dupes = masterdata.potential_duplicate_masters(conn, args.kind)
    if dupes:
        print(f"[master] {len(dupes)} potential duplicate master record group(s) — review, "
              f"merging is not automatic")
    return EXIT_OK


def cmd_period(args, conn) -> int:
    """Show or advance the reporting-period lifecycle."""
    try:
        if args.action == "show":
            for p in conn.execute("SELECT id FROM reporting_periods ORDER BY label"):
                per = periods_mod.get(conn, p["id"])
                print(f"  {per.label:10} {per.state:13} (locked={bool(per.locked)})")
            return EXIT_OK
        pid = _period_id(conn, args.label)
        if args.action == "reopen":
            per = periods_mod.reopen(conn, pid, reason=args.reason or "",
                                     authorized_by=args.authorized_by or "")
        elif args.action == "lock":
            per = periods_mod.lock(conn, pid, actor=args.authorized_by or "operator",
                                   reason=args.reason)
        else:
            per = periods_mod.transition(conn, pid, args.action,
                                         actor=args.authorized_by or "operator", reason=args.reason)
    except periods_mod.PeriodError as e:
        print(f"[period] REFUSED: {e}", file=sys.stderr)
        return EXIT_REFUSED
    conn.commit()
    print(f"[period] {per.label} is now '{per.state}'")
    return EXIT_OK


def cmd_explain(args, conn) -> int:
    """Show full provenance for a document (why every number is what it is)."""
    try:
        print(json.dumps(explain.explain_transaction(conn, args.transaction_id), indent=2, default=str))
    except KeyError as e:
        print(f"[explain] {e}", file=sys.stderr)
        return EXIT_ERROR
    return EXIT_OK


def cmd_find(args, conn) -> int:
    hits = explain.find_transactions(conn, args.query)
    print(f"[find] {len(hits)} match(es)")
    for h in hits:
        print(f"  {h['id']}  {h['transaction_type']:14} lines={h['line_count']}  {h['invoice_date'] or ''}")
    return EXIT_OK


def cmd_evidence(args, conn) -> int:
    """Record alternative cost evidence on a line and reclassify it."""
    ce.install_default_policy(conn, DEFAULT_POLICY.key())
    try:
        res = resolution.apply_cost_evidence(
            conn, transaction_line_id=args.line_id, evidence_type=args.type,
            policy=DEFAULT_POLICY, matrix=EvidenceMatrix(), amount=args.amount,
            source_reference=args.ref, expires_on=args.expires)
    except (KeyError, ValueError) as e:
        print(f"[evidence] {e}", file=sys.stderr)
        print(f"[evidence] valid types: {', '.join(ce.ALL_TYPES)}", file=sys.stderr)
        return EXIT_ERROR
    conn.commit()
    print(f"[evidence] cost is now '{res['cost_level']}'; {res['new_snapshots']} new snapshots")
    return EXIT_OK


def cmd_reconcile(args, conn) -> int:
    n = pipeline.run_reconciliation(conn, _period_id(conn, args.period), getattr(args, "batch", None))
    conn.commit()
    print(f"[reconcile] {n} findings recorded")
    return EXIT_OK


def cmd_report(args, conn) -> int:
    try:
        scope = _scope(conn, args)
    except ValueError as e:
        print(f"[report] {e}", file=sys.stderr)
        return EXIT_ERROR
    rep = batch_report.build_report(conn, scope, DEFAULT_POLICY)
    print(json.dumps(rep, indent=2, default=str))
    if not rep["valid"]:
        print("[report] INTEGRITY FAILURE — report is not verified", file=sys.stderr)
        return EXIT_INTEGRITY
    return EXIT_OK


def cmd_export(args, conn) -> int:
    try:
        scope = _scope(conn, args)
    except ValueError as e:
        print(f"[export] {e}", file=sys.stderr)
        return EXIT_ERROR
    rep = batch_report.build_report(conn, scope, DEFAULT_POLICY)
    if not rep["valid"]:
        print("[export] REFUSED — report failed integrity assertions", file=sys.stderr)
        return EXIT_INTEGRITY
    out_dir = export_mod.export_report(rep)
    batch_report.persist_manifest(conn, rep); conn.commit()
    print(f"[export] wrote package to {out_dir}")
    return EXIT_OK


def cmd_safety_scan(args, conn) -> int:
    root = Path(__file__).resolve().parent.parent
    paths = list(root.rglob("*.py")) + list((root / "fixtures").glob("*"))
    rep = scanner.scan_paths(paths)
    print(f"[safety-scan] {rep.summary()}")
    for f in rep.high:
        print(f"  HIGH {f.kind} {f.path}:{f.line}")
    return EXIT_OK if rep.ok else EXIT_REFUSED


def cmd_selfcheck(args, conn) -> int:
    """End-to-end install verification on an in-memory database (no real data touched)."""
    from .db import init_db as _init
    fixture = Path(__file__).resolve().parent.parent / "fixtures" / "sample_month_v2.csv"
    c = _init(":memory:")
    try:
        rules = {}
        for code, name, basis, rate in (("CR-GP10", "GP 10%", "gross_profit", "0.10"),
                                        ("CR-REV5", "Rev 5%", "revenue", "0.05")):
            rid = new_id("commission_rule")
            c.execute("""INSERT INTO commission_rules(id, name, basis, rate_canonical, eligibility,
                         created_at) VALUES (?, ?, ?, ?, 'on_invoice', ?)""",
                      (rid, name, basis, rate, utcnow_iso()))
            rules[code] = rid
        pid = new_id("reporting_period")
        c.execute("""INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
                     VALUES (?, '2026-06', '2026-06-01', '2026-06-30', 0, ?)""", (pid, utcnow_iso()))
        out = pipeline.register_and_stage(
            c, filename="selfcheck.csv", content=fixture.read_bytes(), profile=_profile(),
            matrix=EvidenceMatrix(), policy=DEFAULT_POLICY, period_id=pid, rule_lookup=rules)
        pipeline.analyze(c, out.batch_id)
        posted = pipeline.post(c, out.batch_id, DEFAULT_POLICY)
        pipeline.run_reconciliation(c, pid, out.batch_id)
        rep = batch_report.build_report(c, ReportScope.for_batch(pid, out.batch_id, DEFAULT_POLICY), DEFAULT_POLICY)
        ok = posted["snapshots_created"] > 0 and rep["valid"]
        print(f"[selfcheck] posted={posted['posted_transactions']} snapshots={posted['snapshots_created']} "
              f"integrity={'PASS' if rep['valid'] else 'FAIL'}")
        print("[selfcheck] OK — installation is healthy." if ok else "[selfcheck] FAIL")
        return EXIT_OK if ok else EXIT_ERROR
    finally:
        c.close()


def cmd_backup(args, conn) -> int:
    dest = Path(args.out or (Path(args.db or default_db_path()).parent /
                             f"backup-{utcnow_iso().replace(':','').replace('-','')}.db"))
    backup_mod.create_backup(conn, dest)
    rep = backup_mod.validate_backup(dest)
    print(f"[backup] wrote {dest} ({dest.stat().st_size} bytes)")
    print(f"[backup] validation: {rep.summary()}")
    if not rep.ok:
        for prob in rep.problems:
            print(f"[backup]   problem: {prob}", file=sys.stderr)
        return EXIT_ERROR
    return EXIT_OK


def cmd_verify_backup(args, conn) -> int:
    rep = backup_mod.validate_backup(args.path)
    print(f"[verify-backup] {rep.summary()}")
    for prob in rep.problems:
        print(f"[verify-backup]   problem: {prob}", file=sys.stderr)
    return EXIT_OK if rep.ok else EXIT_ERROR


def cmd_restore_preview(args, conn) -> int:
    prev = backup_mod.preview_restore(args.path, args.db or str(default_db_path()))
    print(json.dumps(prev, indent=2))
    return EXIT_OK if prev["safe_to_restore"] else EXIT_REFUSED


def cmd_restore(args, conn) -> int:
    if not args.confirm:
        print("[restore] REFUSED: pass --confirm to overwrite the active database "
              "(a safety backup is taken automatically first)", file=sys.stderr)
        return EXIT_REFUSED
    conn.close()          # release the active database before replacing it
    try:
        result = backup_mod.restore(args.path, args.db or str(default_db_path()), confirm=True)
    except ValueError as e:
        print(f"[restore] REFUSED: {e}", file=sys.stderr)
        return EXIT_REFUSED
    print(json.dumps(result, indent=2))
    return EXIT_OK if result["restored_ok"] else EXIT_ERROR


def cmd_match_payments(args, conn) -> int:
    """Propose payment -> invoice matches (nothing is applied without --approve)."""
    scope = _scope(conn, args)
    props = payment_matching.propose_matches(conn, scope)
    if not props:
        print("[match] no proposals — no unapplied cash against open invoices in scope")
        return EXIT_OK
    print(f"[match] {len(props)} proposal(s); nothing applied yet")
    for i, c in enumerate(props, start=1):
        print(f"  {i}. invoice {c.invoice_ref or c.invoice_id} balance {c.invoice_balance} "
              f"<- {c.suggested_amount} (score {c.score})")
        print(f"     for: {'; '.join(c.matching_signals)}")
        if c.conflicting_signals:
            print(f"     against: {'; '.join(c.conflicting_signals)}")
        print(f"     disposition: {c.recommended_disposition}")
    if args.approve:
        applied = 0
        for c in props:
            if args.only_exact and "exact match" not in c.recommended_disposition:
                continue
            payment_matching.apply_proposal(conn, c, approved_by=args.approve)
            applied += 1
        conn.commit()
        print(f"[match] applied {applied} proposal(s) approved by {args.approve}")
    return EXIT_OK


def cmd_receivables(args, conn) -> int:
    scope = _scope(conn, args)
    bridge = cash.cash_bridge(conn, scope)
    print(json.dumps(bridge, indent=2))
    return EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="finance-system", description="JM Equipment monthly close CLI")
    p.add_argument("--db", help="path to the private database (default: gitignored .data/finance.db)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("initialize").set_defaults(func=cmd_initialize)
    pi = sub.add_parser("import"); pi.add_argument("file")
    pi.add_argument("--period"); pi.add_argument("--post", action="store_true")
    pi.add_argument("--dry-run", action="store_true"); pi.add_argument("--allow-duplicates", action="store_true")
    pi.set_defaults(func=cmd_import)
    pr = sub.add_parser("review"); pr.add_argument("batch_id"); pr.set_defaults(func=cmd_review)
    pp = sub.add_parser("post"); pp.add_argument("batch_id"); pp.set_defaults(func=cmd_post)
    pb = sub.add_parser("rollback"); pb.add_argument("batch_id"); pb.set_defaults(func=cmd_rollback)
    sub.add_parser("exceptions").set_defaults(func=cmd_exceptions)
    pres = sub.add_parser("resolve"); pres.add_argument("exception_id")
    pres.add_argument("--product-cost", required=True); pres.add_argument("--vendor-bill")
    pres.add_argument("--evidence-ref"); pres.set_defaults(func=cmd_resolve)
    prc = sub.add_parser("reconcile"); prc.add_argument("--period"); prc.add_argument("--batch")
    prc.set_defaults(func=cmd_reconcile)
    prp = sub.add_parser("report"); prp.add_argument("--batch"); prp.add_argument("--period")
    prp.add_argument("--all-time", action="store_true"); prp.set_defaults(func=cmd_report)
    pe = sub.add_parser("export"); pe.add_argument("--batch"); pe.add_argument("--period")
    pe.add_argument("--all-time", action="store_true"); pe.set_defaults(func=cmd_export)
    sub.add_parser("safety-scan").set_defaults(func=cmd_safety_scan)
    sub.add_parser("selfcheck").set_defaults(func=cmd_selfcheck)
    pv = sub.add_parser("verify-backup"); pv.add_argument("path"); pv.set_defaults(func=cmd_verify_backup)
    prv = sub.add_parser("restore-preview"); prv.add_argument("path"); prv.set_defaults(func=cmd_restore_preview)
    prs = sub.add_parser("restore"); prs.add_argument("path")
    prs.add_argument("--confirm", action="store_true"); prs.set_defaults(func=cmd_restore)
    pc = sub.add_parser("config")
    pc.add_argument("action", choices=["show", "set", "rule", "evidence"])
    pc.add_argument("key", nargs="?"); pc.add_argument("value", nargs="?")
    pc.add_argument("--name"); pc.add_argument("--basis")
    pc.set_defaults(func=cmd_config)
    pm = sub.add_parser("master")
    pm.add_argument("kind", choices=["customer", "vendor", "product"])
    pm.add_argument("query", nargs="?"); pm.add_argument("--id")
    pm.set_defaults(func=cmd_master)
    pp2 = sub.add_parser("period")
    pp2.add_argument("action", choices=["show", "under_review", "verified", "lock", "reopen", "open"])
    pp2.add_argument("--label"); pp2.add_argument("--reason"); pp2.add_argument("--authorized-by")
    pp2.set_defaults(func=cmd_period)
    pex = sub.add_parser("explain"); pex.add_argument("transaction_id"); pex.set_defaults(func=cmd_explain)
    pfd = sub.add_parser("find"); pfd.add_argument("query"); pfd.set_defaults(func=cmd_find)
    pev = sub.add_parser("evidence"); pev.add_argument("line_id")
    pev.add_argument("--type", required=True, choices=list(ce.ALL_TYPES))
    pev.add_argument("--amount"); pev.add_argument("--ref"); pev.add_argument("--expires")
    pev.set_defaults(func=cmd_evidence)
    pmt = sub.add_parser("match-payments"); pmt.add_argument("--period"); pmt.add_argument("--batch")
    pmt.add_argument("--all-time", action="store_true")
    pmt.add_argument("--approve", help="approver name; applies the proposals")
    pmt.add_argument("--only-exact", action="store_true")
    pmt.set_defaults(func=cmd_match_payments)
    prc2 = sub.add_parser("receivables"); prc2.add_argument("--period"); prc2.add_argument("--batch")
    prc2.add_argument("--all-time", action="store_true"); prc2.set_defaults(func=cmd_receivables)
    pbk = sub.add_parser("backup"); pbk.add_argument("--out"); pbk.set_defaults(func=cmd_backup)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    conn = init_db(args.db or str(default_db_path()))
    try:
        return args.func(args, conn)
    finally:
        conn.close()   # deterministic close — no leaked handles


if __name__ == "__main__":
    raise SystemExit(main())
