"""Command-line workflow for the monthly close (§14).

Operates on the private local database (default: gitignored .data/finance.db). Commands
return meaningful exit codes, avoid printing raw customer PII, explain failures, support
dry runs, refuse posting into a locked period, and refuse exact-duplicate posting without
an authorized override.

Usage:
  python -m finance_system.cli initialize
  python -m finance_system.cli import <file> [--period 2026-06] [--post] [--dry-run] [--allow-duplicates]
  python -m finance_system.cli review <batch_id>
  python -m finance_system.cli post <batch_id>
  python -m finance_system.cli rollback <batch_id>
  python -m finance_system.cli exceptions
  python -m finance_system.cli resolve <exception_id> --product-cost 90.00 [--vendor-bill VB-1]
  python -m finance_system.cli reconcile [--period 2026-06]
  python -m finance_system.cli report [--batch <id>]
  python -m finance_system.cli export [--batch <id>]
  python -m finance_system.cli safety-scan
  python -m finance_system.cli backup
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

from . import batch_report, export as export_mod, imports, pipeline, resolution, scanner
from .db import default_db_path, init_db, utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .mapping import MappingProfile
from .policies import DEFAULT_POLICY

EXIT_OK, EXIT_ERROR, EXIT_REFUSED = 0, 1, 2


def _conn(args) -> sqlite3.Connection:
    return init_db(args.db or str(default_db_path()))


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


def cmd_initialize(args) -> int:
    conn = _conn(args)
    table_count = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    print(f"[init] database ready at: {args.db or default_db_path()}")
    print(f"[init] schema migrations applied; tables: {table_count}")
    return EXIT_OK


def cmd_import(args) -> int:
    conn = _conn(args)
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
    review = pipeline.review_summary(conn, out.batch_id)
    print(f"[import] batch {out.batch_id}")
    print(f"[import] active db: {args.db or default_db_path()}")
    print(f"[import] rows received={out.rows_received} staged={out.rows_staged} "
          f"row_errors={out.row_errors} duplicate_file={out.is_duplicate_file}")
    print(f"[import] exact_duplicates={len(analysis.exact_duplicates)} "
          f"likely_duplicates={analysis.likely_duplicates} conflicts={analysis.conflicts}")
    print(f"[import] review: {json.dumps(review)}")
    if args.dry_run:
        imports.rollback_batch(conn, out.batch_id)
        conn.commit()
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


def cmd_review(args) -> int:
    conn = _conn(args)
    print(json.dumps(pipeline.review_summary(conn, args.batch_id), indent=2))
    return EXIT_OK


def cmd_post(args) -> int:
    conn = _conn(args)
    try:
        res = pipeline.post(conn, args.batch_id, DEFAULT_POLICY)
    except ValueError as e:
        print(f"[post] REFUSED: {e}", file=sys.stderr)
        return EXIT_REFUSED
    conn.commit()
    print(f"[post] {json.dumps(res)}")
    return EXIT_OK


def cmd_rollback(args) -> int:
    conn = _conn(args)
    try:
        imports.rollback_batch(conn, args.batch_id)
    except ValueError as e:
        print(f"[rollback] REFUSED: {e}", file=sys.stderr)
        return EXIT_REFUSED
    conn.commit()
    print(f"[rollback] batch {args.batch_id} rolled back.")
    return EXIT_OK


def cmd_exceptions(args) -> int:
    conn = _conn(args)
    rows = conn.execute(
        """SELECT id, calculation_type, priority, status, missing_information
           FROM exceptions WHERE status!='resolved' ORDER BY priority, created_at""").fetchall()
    print(f"[exceptions] {len(rows)} open")
    for r in rows:  # id + calc + priority only — no customer PII
        print(f"  {r['id']}  {r['calculation_type']:14} {r['priority']:6} {r['missing_information']}")
    return EXIT_OK


def cmd_resolve(args) -> int:
    conn = _conn(args)
    try:
        res = resolution.supply_cost_evidence(
            conn, args.exception_id, product_cost=args.product_cost, policy=DEFAULT_POLICY,
            matrix=EvidenceMatrix(), vendor_bill_number=args.vendor_bill,
            evidence_ref=args.evidence_ref)
    except KeyError as e:
        print(f"[resolve] {e}", file=sys.stderr)
        return EXIT_ERROR
    conn.commit()
    print(f"[resolve] {json.dumps(res)}")
    return EXIT_OK


def cmd_reconcile(args) -> int:
    conn = _conn(args)
    n = pipeline.run_reconciliation(conn, _period_id(conn, args.period))
    conn.commit()
    print(f"[reconcile] {n} findings recorded")
    return EXIT_OK


def cmd_report(args) -> int:
    conn = _conn(args)
    batch_id = args.batch or _latest_batch(conn)
    if not batch_id:
        print("[report] no batches found", file=sys.stderr)
        return EXIT_ERROR
    rep = batch_report.build_report(conn, batch_id, DEFAULT_POLICY, _period_id(conn, args.period))
    print(json.dumps(rep, indent=2, default=str))
    return EXIT_OK


def cmd_export(args) -> int:
    conn = _conn(args)
    batch_id = args.batch or _latest_batch(conn)
    if not batch_id:
        print("[export] no batches found", file=sys.stderr)
        return EXIT_ERROR
    rep = batch_report.build_report(conn, batch_id, DEFAULT_POLICY, _period_id(conn, args.period))
    out_dir = export_mod.export_report(rep)
    print(f"[export] wrote package to {out_dir}")
    return EXIT_OK


def cmd_safety_scan(args) -> int:
    root = Path(__file__).resolve().parent.parent
    paths = list(root.rglob("*.py")) + list((root / "fixtures").glob("*"))
    rep = scanner.scan_paths(paths)
    print(f"[safety-scan] {rep.summary()}")
    for f in rep.high:
        print(f"  HIGH {f.kind} {f.path}:{f.line}")
    return EXIT_OK if rep.ok else EXIT_REFUSED


def cmd_backup(args) -> int:
    conn = _conn(args)
    conn.commit()
    dest = Path(args.out or (Path(args.db or default_db_path()).parent /
                             f"backup-{utcnow_iso().replace(':','').replace('-','')}.db"))
    dest.parent.mkdir(parents=True, exist_ok=True)
    bkp = sqlite3.connect(str(dest))
    try:
        conn.backup(bkp)
    finally:
        bkp.close()
    print(f"[backup] wrote {dest} ({dest.stat().st_size} bytes)")
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

    prc = sub.add_parser("reconcile"); prc.add_argument("--period"); prc.set_defaults(func=cmd_reconcile)
    prp = sub.add_parser("report"); prp.add_argument("--batch"); prp.add_argument("--period")
    prp.set_defaults(func=cmd_report)
    pe = sub.add_parser("export"); pe.add_argument("--batch"); pe.add_argument("--period")
    pe.set_defaults(func=cmd_export)
    sub.add_parser("safety-scan").set_defaults(func=cmd_safety_scan)
    pbk = sub.add_parser("backup"); pbk.add_argument("--out"); pbk.set_defaults(func=cmd_backup)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
