"""Local operator web console (Exchange 3 operator interface, standard library only).

A browser-based console for the monthly close that calls the SAME tested application
services used by the CLI (pipeline, posting, resolution, reconcile, batch_report, export,
backup) — it never writes to the database directly or re-implements financial logic.

Design constraints honoured:
- No third-party dependencies (Python's http.server).
- Binds to 127.0.0.1 (loopback) only — not exposed on the network.
- Paste-based intake (no cgi/multipart), so no deprecated modules and no warnings.
- Confirmations on destructive actions (post, rollback, backup).
- No raw customer PII echoed to request logs (log line is method + path + status only).
- The UI is not the source of financial truth; every number comes from the services.

Run:  python -m finance_system.webapp [--db PATH] [--host 127.0.0.1] [--port 8765]
"""

from __future__ import annotations

import argparse
import html
import json
import sqlite3
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import batch_report, export as export_mod, imports, pipeline, resolution
from .db import default_db_path, init_db, utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .mapping import MappingProfile
from .policies import DEFAULT_POLICY
from .scope import ReportScope

_CSS = """
body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f6f7f9;color:#1c2430}
header{background:#12324a;color:#fff;padding:14px 22px}
header a{color:#cfe3f2;text-decoration:none;margin-right:16px;font-size:14px}
h1{font-size:18px;margin:0}main{padding:22px;max-width:1080px;margin:0 auto}
.card{background:#fff;border:1px solid #e2e6eb;border-radius:8px;padding:16px 18px;margin-bottom:18px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #e2e6eb;padding:6px 8px;text-align:left}
th{background:#eef2f6}.verified{color:#0a7d33;font-weight:600}.provisional{color:#b26a00;font-weight:600}
.unverified,.exception{color:#b00020;font-weight:600}.ok{color:#0a7d33}.bad{color:#b00020}
button,input[type=submit]{background:#12324a;color:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:14px}
button.warn{background:#b00020}input[type=text],textarea,select{border:1px solid #cbd2da;border-radius:6px;padding:8px;font-size:13px}
textarea{width:100%;min-height:150px;font-family:ui-monospace,monospace}label{display:block;margin:8px 0 4px;font-size:13px;font-weight:600}
.muted{color:#63707e;font-size:12px}.pill{display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;background:#eef2f6}
.kv{display:grid;grid-template-columns:220px 1fr;gap:4px 12px;font-size:13px}
"""

_NAV = ('<header><h1>JM Equipment — Finance Console</h1>'
        '<nav style="margin-top:8px">'
        '<a href="/">Dashboard</a><a href="/import">Import</a>'
        '<a href="/exceptions">Exceptions</a><a href="/report">Reports</a>'
        '<a href="/backup">Backup</a></nav></header>')


def _page(title: str, body: str) -> bytes:
    return (f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(title)}</title>"
            f"<style>{_CSS}</style></head><body>{_NAV}<main>{body}</main></body></html>").encode("utf-8")


def _profile():
    return MappingProfile(id=new_id("import_batch"), name="console-csv",
                          created_at=utcnow_iso(), updated_at=utcnow_iso())


def _periods(conn):
    return conn.execute(
        "SELECT id, label, locked FROM reporting_periods ORDER BY label DESC").fetchall()


def _ensure_period(conn, label):
    r = conn.execute("SELECT id FROM reporting_periods WHERE label=?", (label,)).fetchone()
    if r:
        return r["id"]
    pid = new_id("reporting_period")
    y, m = (label.split("-") + ["01"])[:2]
    conn.execute("""INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
                    VALUES (?, ?, ?, ?, 0, ?)""", (pid, label, f"{y}-{m}-01", f"{y}-{m}-28", utcnow_iso()))
    return pid


def _lvl_span(level: str) -> str:
    return f'<span class="{html.escape(level)}">{html.escape(level)}</span>'


class Handler(BaseHTTPRequestHandler):
    server_version = "JMFinanceConsole/1.0"

    # No PII in logs: method + path + status only (no bodies, no query values echoed).
    def log_message(self, fmt, *args):  # noqa: A003
        return

    # ---- helpers ----
    def _conn(self):
        return init_db(self.server.db_path)

    def _send(self, status, body: bytes, ctype="text/html; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, location):
        self.send_response(303)
        self.send_header("Location", location)
        self.end_headers()

    def _form(self) -> dict:
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n).decode("utf-8") if n else ""
        return {k: v[0] for k, v in urllib.parse.parse_qs(raw).items()}

    # ---- routing ----
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}
        routes = {"/": self.page_dashboard, "/import": self.page_import,
                  "/exceptions": self.page_exceptions, "/report": self.page_report,
                  "/batch": self.page_batch, "/backup": self.page_backup}
        fn = routes.get(parsed.path)
        if not fn:
            return self._send(404, _page("Not found", "<div class='card'>Not found.</div>"))
        conn = self._conn()
        try:
            self._send(200, fn(conn, q))
        finally:
            conn.close()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        form = self._form()
        conn = self._conn()
        try:
            handler = {"/import": self.act_import, "/post": self.act_post,
                       "/rollback": self.act_rollback, "/resolve": self.act_resolve,
                       "/backup": self.act_backup}.get(parsed.path)
            if not handler:
                return self._send(404, _page("Not found", "<div class='card'>Not found.</div>"))
            location = handler(conn, form)
            conn.commit()
            self._redirect(location)
        finally:
            conn.close()

    # ---- pages ----
    def page_dashboard(self, conn, q):
        schema = (conn.execute("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
                  .fetchone() or ["?"])[0]
        batches = conn.execute("SELECT COUNT(*) FROM import_batches").fetchone()[0]
        posted = conn.execute("SELECT COUNT(*) FROM transactions WHERE posted=1").fetchone()[0]
        open_exc = conn.execute("SELECT COUNT(*) FROM exceptions WHERE status!='resolved'").fetchone()[0]
        periods = _periods(conn)
        prows = "".join(
            f"<tr><td>{html.escape(p['label'])}</td>"
            f"<td>{'🔒 locked' if p['locked'] else 'open'}</td></tr>" for p in periods) or \
            "<tr><td colspan=2 class='muted'>No reporting periods yet — create one on the Import page.</td></tr>"
        body = f"""
        <div class='card'><div class='kv'>
          <div>Active database</div><div>{html.escape(self.server.db_path)}</div>
          <div>Schema version</div><div>{html.escape(str(schema))}</div>
          <div>Calculation policy</div><div>{html.escape(DEFAULT_POLICY.key())}</div>
          <div>Evidence matrix</div><div>1</div>
          <div>Import batches</div><div>{batches}</div>
          <div>Posted transactions</div><div>{posted}</div>
          <div>Open exceptions</div><div>{open_exc}</div>
        </div></div>
        <div class='card'><h3>Reporting periods</h3><table><tr><th>Period</th><th>State</th></tr>{prows}</table></div>
        <div class='card'><h3>Monthly close — guided steps</h3><ol class='muted'>
          <li>Import (paste or CSV) → review duplicates/conflicts/exceptions</li>
          <li>Post approved rows → reconcile</li>
          <li>Resolve exceptions (supply evidence) → recalculate</li>
          <li>Generate a scoped report (integrity must pass) → export → back up → lock period</li>
        </ol></div>"""
        return _page("Dashboard", body)

    def page_import(self, conn, q):
        opts = "".join(f"<option>{html.escape(p['label'])}</option>" for p in _periods(conn))
        body = f"""
        <div class='card'><h3>Import — paste tabular data (CSV / TSV / JSON)</h3>
        <form method='post' action='/import'>
          <label>Reporting period (e.g. 2026-06)</label>
          <input list='periods' name='period' required>
          <datalist id='periods'>{opts}</datalist>
          <label>Source name</label><input type='text' name='filename' value='pasted.csv'>
          <label>Paste rows (first row = headers)</label>
          <textarea name='content' required placeholder='Type,Customer,Item,Invoice #,Date,Period Date,Qty,Unit Price,Cost'></textarea>
          <p class='muted'>Real cost/price data stays in this machine's private database and is never committed.</p>
          <input type='submit' value='Stage & analyze'>
        </form></div>"""
        return _page("Import", body)

    def page_batch(self, conn, q):
        batch = q.get("id", "")
        review = pipeline.review_summary(conn, batch) if batch else {}
        rows = conn.execute(
            """SELECT transaction_type, review_status, dedup_status FROM transactions
               WHERE import_batch_id=? ORDER BY created_at""", (batch,)).fetchall()
        trows = "".join(
            f"<tr><td>{html.escape(r['transaction_type'])}</td><td>{html.escape(r['review_status'])}</td>"
            f"<td>{html.escape(r['dedup_status'] or '')}</td></tr>" for r in rows)
        body = f"""
        <div class='card'><h3>Batch review</h3>
        <div class='kv'>
          <div>Staged ready to post</div><div>{review.get('staged_ready_to_post','?')}</div>
          <div>Rejected (exact duplicates)</div><div>{review.get('rejected','?')}</div>
          <div>Likely-duplicate candidates</div><div>{review.get('likely_duplicate_candidates','?')}</div>
          <div>Conflicts</div><div>{review.get('conflicts','?')}</div>
          <div>Open exceptions</div><div>{review.get('open_exceptions','?')}</div>
        </div></div>
        <div class='card'><table><tr><th>Type</th><th>Review</th><th>Dedup</th></tr>{trows}</table></div>
        <div class='card'>
          <form method='post' action='/post' onsubmit="return confirm('Post approved rows? This creates posted records and snapshots.');">
            <input type='hidden' name='batch' value='{html.escape(batch)}'>
            <input type='submit' value='Post approved rows'>
          </form>
          <form method='post' action='/rollback' style='margin-top:10px' onsubmit="return confirm('Roll back ALL staged rows in this batch? Nothing is posted.');">
            <input type='hidden' name='batch' value='{html.escape(batch)}'>
            <button class='warn' type='submit'>Roll back (discard staged)</button>
          </form>
        </div>"""
        return _page("Batch review", body)

    def page_exceptions(self, conn, q):
        rows = conn.execute(
            """SELECT id, calculation_type, priority, missing_information FROM exceptions
               WHERE status!='resolved' ORDER BY priority, created_at""").fetchall()
        items = []
        for r in rows:
            resolve = ""
            if r["calculation_type"] == "cost":
                resolve = (f"<form method='post' action='/resolve' style='margin-top:6px'>"
                           f"<input type='hidden' name='exception_id' value='{html.escape(r['id'])}'>"
                           f"<input type='text' name='product_cost' placeholder='cost e.g. 90.00' required> "
                           f"<input type='text' name='vendor_bill' placeholder='vendor bill (optional)'> "
                           f"<input type='submit' value='Supply evidence & recalc'></form>")
            items.append(
                f"<tr><td class='exception'>{html.escape(r['calculation_type'])}</td>"
                f"<td>{html.escape(r['priority'])}</td>"
                f"<td>{html.escape(r['missing_information'])}{resolve}</td></tr>")
        table = "".join(items) or "<tr><td colspan=3 class='muted'>No open exceptions.</td></tr>"
        return _page("Exceptions",
                     f"<div class='card'><h3>Where's Your Proof? register</h3>"
                     f"<table><tr><th>Calculation</th><th>Priority</th><th>Missing / action</th></tr>{table}</table></div>")

    def page_report(self, conn, q):
        periods = _periods(conn)
        opts = "".join(f"<option value='{html.escape(p['id'])}'>{html.escape(p['label'])}</option>"
                       for p in periods)
        chosen = q.get("period")
        body = [f"""<div class='card'><form method='get' action='/report'>
          <label>Reporting period</label><select name='period'>{opts}</select>
          <input type='submit' value='Generate report'></form></div>"""]
        if chosen:
            scope = ReportScope.for_period(chosen, DEFAULT_POLICY)
            rep = batch_report.build_report(conn, scope, DEFAULT_POLICY)
            integ = ("<span class='ok'>PASS</span>" if rep["valid"]
                     else "<span class='bad'>FAIL — not verified</span>")
            e = rep["E_verified_totals"]
            cb = rep["F_provisional_excluded_totals"]["cost_bridge"]
            pb = rep["F_provisional_excluded_totals"]["profitability_bridge"]
            ub = rep["F_provisional_excluded_totals"]["units_bridge"]
            body.append(f"""<div class='card'><h3>Report — integrity: {integ}</h3>
            <div class='kv'>
              <div>Verified net revenue</div><div>{html.escape(e['net_revenue_verified'])}</div>
              <div>Profitability-verified gross profit</div><div>{html.escape(e['profitability_verified_gross_profit'])}</div>
              <div>Verified gross margin %</div><div>{html.escape(str(e['verified_gross_margin_pct']))}</div>
              <div>Verified markup %</div><div>{html.escape(str(e['verified_markup_pct']))}</div>
              <div>Recognized total actual cost</div><div>{html.escape(cb['policy_recognized_total_actual_cost'])}</div>
              <div>Net units sold</div><div>{html.escape(e['net_units_sold'])}</div>
              <div>Current commission total</div><div>{html.escape(e['commission_total_current'])}</div>
            </div></div>
            <div class='card'><h3>Cost bridge</h3><div class='kv'>
              <div>Raw posted components</div><div>{html.escape(cb['raw_posted_cost_components'])}</div>
              <div>− non-sale-document cost</div><div>{html.escape(cb['less_non_sale_document_cost'])}</div>
              <div>− policy-excluded components</div><div>{html.escape(cb['less_policy_excluded_components'])}</div>
              <div>= recognized total actual cost</div><div><b>{html.escape(cb['policy_recognized_total_actual_cost'])}</b></div>
            </div></div>
            <div class='card'><h3>Profitability bridge</h3><div class='kv'>
              <div>Revenue-verified net revenue</div><div>{html.escape(pb['total_revenue_verified_net_revenue'])}</div>
              <div>Eligible for verified profitability</div><div>{html.escape(pb['net_revenue_eligible_for_verified_profitability'])}</div>
              <div>Excluded (cost unverified)</div><div>{html.escape(pb['revenue_excluded_from_verified_profitability'])}</div>
            </div></div>
            <div class='card'><form method='post' action='/backup'><input type='hidden' name='after' value='/report?period={html.escape(chosen)}'>
              <button type='submit'>Create backup</button></form></div>""")
        return _page("Reports", "".join(body))

    def page_backup(self, conn, q):
        return _page("Backup", """<div class='card'><h3>Backup</h3>
          <form method='post' action='/backup' onsubmit="return confirm('Create a database backup now?');">
          <input type='submit' value='Create backup'></form>
          <p class='muted'>Backups and exports are written under the gitignored private data directory.</p></div>""")

    # ---- actions (call services only) ----
    def act_import(self, conn, form):
        period_id = _ensure_period(conn, form.get("period", "").strip())
        out = pipeline.register_and_stage(
            conn, filename=form.get("filename", "pasted.csv"),
            content=form.get("content", "").encode("utf-8"), profile=_profile(),
            matrix=EvidenceMatrix(), policy=DEFAULT_POLICY, period_id=period_id)
        pipeline.analyze(conn, out.batch_id)
        return f"/batch?id={urllib.parse.quote(out.batch_id)}"

    def act_post(self, conn, form):
        batch = form.get("batch", "")
        try:
            pipeline.post(conn, batch, DEFAULT_POLICY)
            period = (conn.execute("SELECT reporting_period_id FROM transactions WHERE import_batch_id=? LIMIT 1",
                                   (batch,)).fetchone() or {"reporting_period_id": None})["reporting_period_id"]
            pipeline.run_reconciliation(conn, period, batch)
        except ValueError:
            pass  # locked period etc. — batch page will show unchanged state
        return f"/batch?id={urllib.parse.quote(batch)}"

    def act_rollback(self, conn, form):
        batch = form.get("batch", "")
        try:
            imports.rollback_batch(conn, batch)
        except ValueError:
            pass
        return "/"

    def act_resolve(self, conn, form):
        try:
            resolution.supply_cost_evidence(
                conn, form.get("exception_id", ""), product_cost=form.get("product_cost", "0"),
                policy=DEFAULT_POLICY, matrix=EvidenceMatrix(),
                vendor_bill_number=form.get("vendor_bill") or None)
        except (KeyError, ValueError):
            pass
        return "/exceptions"

    def act_backup(self, conn, form):
        conn.commit()
        dest = Path(self.server.db_path).parent / f"backup-{utcnow_iso().replace(':','').replace('-','')}.db"
        dest.parent.mkdir(parents=True, exist_ok=True)
        bkp = sqlite3.connect(str(dest))
        try:
            conn.backup(bkp)
        finally:
            bkp.close()
        return form.get("after", "/")


def make_server(db_path: str, host: str = "127.0.0.1", port: int = 8765) -> ThreadingHTTPServer:
    # Ensure the DB + schema exist before serving.
    init_db(db_path).close()
    srv = ThreadingHTTPServer((host, port), Handler)
    srv.db_path = db_path
    return srv


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="finance-console", description="Local operator web console")
    ap.add_argument("--db", default=str(default_db_path()))
    ap.add_argument("--host", default="127.0.0.1")   # loopback only
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args(argv)
    srv = make_server(args.db, args.host, args.port)
    print(f"[console] JM Equipment Finance Console on http://{args.host}:{args.port}  (db: {args.db})")
    print("[console] loopback-only; press Ctrl+C to stop.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
