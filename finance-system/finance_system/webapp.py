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

from . import backup as backup_mod, batch_report, cash, config as config_mod, explain, export as export_mod, imports, masterdata, periods, pipeline, resolution
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
        '<a href="/receivables">Receivables</a><a href="/find">Find</a>'
        '<a href="/master">Master data</a><a href="/config">Configuration</a>'
        '<a href="/periods">Periods</a>'
        '<a href="/backup">Backup</a></nav></header>')


def _flash(q: dict) -> str:
    """Render success/error banners passed via the redirect query string."""
    out = []
    if q.get("ok"):
        out.append(f"<div class='card' style='border-left:5px solid #0a7d33'>"
                   f"<b class='ok'>Done.</b> {html.escape(q['ok'])}</div>")
    if q.get("err"):
        out.append(f"<div class='card' style='border-left:5px solid #b00020'>"
                   f"<b class='bad'>Action refused.</b> {html.escape(q['err'])}</div>")
    return "".join(out)


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
                  "/receivables": self.page_receivables, "/find": self.page_find,
                  "/transaction": self.page_transaction, "/periods": self.page_periods,
                  "/master": self.page_master, "/config": self.page_config,
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
                       "/backup": self.act_backup, "/period": self.act_period,
                       "/config": self.act_config}.get(parsed.path)
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
        {_flash(q)}
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
            """SELECT transaction_type, review_status, dedup_status, line_count FROM transactions
               WHERE import_batch_id=? ORDER BY created_at""", (batch,)).fetchall()
        trows = "".join(
            f"<tr><td>{html.escape(r['transaction_type'])}</td><td>{r['line_count']}</td>"
            f"<td>{html.escape(r['review_status'])}</td>"
            f"<td>{html.escape(r['dedup_status'] or '')}</td></tr>" for r in rows)
        body = f"""
        {_flash(q)}
        <div class='card'><h3>Batch review</h3>
        <div class='kv'>
          <div>Staged ready to post</div><div>{review.get('staged_ready_to_post','?')}</div>
          <div>Rejected (exact duplicates)</div><div>{review.get('rejected','?')}</div>
          <div>Likely-duplicate candidates</div><div>{review.get('likely_duplicate_candidates','?')}</div>
          <div>Conflicts</div><div>{review.get('conflicts','?')}</div>
          <div>Open exceptions</div><div>{review.get('open_exceptions','?')}</div>
        </div></div>
        <div class='card'><table><tr><th>Type</th><th>Lines</th><th>Review</th><th>Dedup</th></tr>{trows}</table></div>
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
                     f"{_flash(q)}<div class='card'><h3>Where's Your Proof? register</h3>"
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

    def page_receivables(self, conn, q):
        periods = _periods(conn)
        opts = "".join(f"<option value='{html.escape(p['id'])}'>{html.escape(p['label'])}</option>"
                       for p in periods)
        body = [f"""<div class='card'><form method='get' action='/receivables'>
          <label>Reporting period</label><select name='period'>{opts}</select>
          <input type='submit' value='Show receivables'></form></div>"""]
        chosen = q.get("period")
        if chosen:
            b = cash.cash_bridge(conn, ReportScope.for_period(chosen, DEFAULT_POLICY))
            counts = b["invoice_status_counts"]
            body.append(f"""<div class='card'><h3>Cash bridge</h3><div class='kv'>
              <div>Invoiced revenue</div><div>{html.escape(b['invoiced_revenue'])}</div>
              <div>Collected cash (applied)</div><div>{html.escape(b['collected_cash_applied'])}</div>
              <div>Outstanding receivable</div><div><b>{html.escape(b['outstanding_receivable'])}</b></div>
              <div>Unapplied cash / deposits</div><div>{html.escape(b['unapplied_cash_deposits'])}</div>
            </div><p class='muted'>{html.escape(b['note'])}</p></div>
            <div class='card'><h3>Invoice status</h3><table>
              <tr><th>Open</th><th>Partially paid</th><th>Paid</th><th>Overpaid</th></tr>
              <tr><td>{counts['open']}</td><td>{counts['partially_paid']}</td>
                  <td>{counts['paid']}</td><td>{counts['overpaid']}</td></tr></table></div>""")
        return _page("Receivables", "".join(body))

    def page_find(self, conn, q):
        term = q.get("q", "")
        body = [f"""<div class='card'><h3>Find a document</h3>
          <form method='get' action='/find'>
            <label>Invoice / SO / PO number, customer, or item</label>
            <input type='text' name='q' value='{html.escape(term)}' required>
            <input type='submit' value='Search'></form></div>"""]
        if term:
            hits = explain.find_transactions(conn, term)
            rows = "".join(
                f"<tr><td><a href='/transaction?id={urllib.parse.quote(h['id'])}'>open</a></td>"
                f"<td>{html.escape(h['transaction_type'])}</td>"
                f"<td>{html.escape(h['customer'] or '')}</td>"
                f"<td>{html.escape(h['invoice_date'] or '')}</td>"
                f"<td>{h['line_count']}</td></tr>" for h in hits)
            body.append(f"""<div class='card'><h3>{len(hits)} match(es)</h3><table>
              <tr><th></th><th>Type</th><th>Customer</th><th>Date</th><th>Lines</th></tr>
              {rows or "<tr><td colspan=5 class='muted'>No matches.</td></tr>"}</table></div>""")
        return _page("Find", "".join(body))

    def page_transaction(self, conn, q):
        try:
            d = explain.explain_transaction(conn, q.get("id", ""))
        except KeyError:
            return _page("Transaction", "<div class='card'>Transaction not found.</div>")
        ext = ", ".join(f"{e['namespace']}={e['value']}" for e in d["external_identifiers"])
        parts = [f"""<div class='card'><h3>{html.escape(d['type'])} — {html.escape(ext or d['transaction_id'])}</h3>
          <div class='kv'>
            <div>Customer</div><div>{html.escape(d['customer'] or '—')}</div>
            <div>Posted</div><div>{'yes' if d['posted'] else 'no'} ({html.escape(d['review_status'] or '')})</div>
            <div>Lines</div><div>{d['line_count']}</div>
            <div>Header total</div><div>{html.escape(str(d['header_total'] or '—'))}</div>
            <div>Dates</div><div>{html.escape(', '.join(f'{k}={v}' for k, v in d['dates'].items()))}</div>
          </div></div>"""]
        if d["cash_application"]:
            c = d["cash_application"]
            parts.append(f"""<div class='card'><h3>Cash application</h3><div class='kv'>
              <div>Invoiced</div><div>{html.escape(c['invoiced'])}</div>
              <div>Applied</div><div>{html.escape(c['applied'])}</div>
              <div>Balance</div><div><b>{html.escape(c['balance'])}</b> ({html.escape(c['status'])})</div>
            </div></div>""")
        for l in d["lines"]:
            ver = "".join(
                f"<tr><td>{html.escape(k)}</td><td>{_lvl_span(v['level'])}</td>"
                f"<td class='muted'>{html.escape(', '.join(v['missing']) or '')}</td></tr>"
                for k, v in sorted(l["verification_by_calculation"].items()))
            snaps = "".join(
                f"<tr><td>{html.escape(k)}</td><td>{html.escape(str(v['output']))}</td>"
                f"<td>{_lvl_span(v['verification'])}</td>"
                f"<td class='muted'>{html.escape(json.dumps(v['inputs'])[:120])}</td></tr>"
                for k, v in sorted(l["current_snapshots"].items()))
            costs = ", ".join(f"{c['component']}={c['amount']}" for c in l["costs"]) or "—"
            parts.append(f"""<div class='card'><h3>Line {l['line_number']}: {html.escape(l['description'] or '')}</h3>
              <div class='kv'>
                <div>Quantity x unit price</div><div>{html.escape(l['quantity'])} x {html.escape(l['unit_price'])}</div>
                <div>Freight / crating billed</div><div>{html.escape(l['freight_billed'])} / {html.escape(l['crating_billed'])}</div>
                <div>Costs</div><div>{html.escape(costs)}</div>
                <div>Superseded snapshots</div><div>{len(l['superseded_snapshots'])} (history retained)</div>
              </div>
              <h4>Verification by calculation</h4>
              <table><tr><th>Calculation</th><th>State</th><th>Missing</th></tr>{ver}</table>
              <h4>Current calculation snapshots (why the number is what it is)</h4>
              <table><tr><th>Calculation</th><th>Output</th><th>State</th><th>Inputs</th></tr>{snaps}</table>
              </div>""")
        if d["exceptions"]:
            rows = "".join(f"<tr><td class='exception'>{html.escape(e['calculation_type'] or '')}</td>"
                           f"<td>{html.escape(e['missing_information'] or '')}</td>"
                           f"<td>{html.escape(e['status'])}</td></tr>" for e in d["exceptions"])
            parts.append(f"<div class='card'><h3>Exceptions</h3><table>"
                         f"<tr><th>Calculation</th><th>Missing</th><th>Status</th></tr>{rows}</table></div>")
        if d["audit_trail"]:
            rows = "".join(f"<tr><td>{html.escape(a['kind'])}</td><td>{html.escape(a['summary'] or '')}</td>"
                           f"<td class='muted'>{html.escape(a['created_at'])}</td></tr>"
                           for a in d["audit_trail"])
            parts.append(f"<div class='card'><h3>Audit history</h3><table>"
                         f"<tr><th>Event</th><th>Summary</th><th>When</th></tr>{rows}</table></div>")
        return _page("Transaction", "".join(parts))

    def page_master(self, conn, q):
        kind = q.get("kind", "customer")
        term = q.get("q", "")
        detail_id = q.get("id")
        tabs = " ".join(
            f"<a href='/master?kind={k}'>{'<b>' if k == kind else ''}{k.title()}s"
            f"{'</b>' if k == kind else ''}</a>" for k in ("customer", "vendor", "product"))
        body = [f"""<div class='card'><h3>Master data</h3><p>{tabs}</p>
          <form method='get' action='/master'>
            <input type='hidden' name='kind' value='{html.escape(kind)}'>
            <label>Search {html.escape(kind)}s</label>
            <input type='text' name='q' value='{html.escape(term)}'>
            <input type='submit' value='Search'></form></div>"""]
        dupes = masterdata.potential_duplicate_masters(conn, kind)
        if dupes:
            rows = "".join(f"<tr><td>{html.escape(d['canonical_key'])}</td><td>{d['count']}</td>"
                           f"<td class='muted'>{html.escape(d['recommended_disposition'])}</td></tr>"
                           for d in dupes)
            body.append(f"<div class='card'><h3>Potential duplicate master records</h3>"
                        f"<table><tr><th>Key</th><th>Records</th><th>Disposition</th></tr>{rows}</table>"
                        f"<p class='muted'>Reported only — merging master data is not performed "
                        f"automatically.</p></div>")
        hits = masterdata.search(conn, kind, term)
        rows = "".join(
            f"<tr><td><a href='/master?kind={kind}&id={urllib.parse.quote(h['id'])}'>{html.escape(h['name'])}</a></td></tr>"
            for h in hits)
        body.append(f"<div class='card'><h3>{len(hits)} {html.escape(kind)}(s)</h3><table>{rows or ''}</table></div>")
        if detail_id:
            try:
                if kind == "customer":
                    d = masterdata.customer_profile(conn, detail_id)
                    hist = "".join(
                        f"<tr><td>{html.escape(x['item'] or '')}</td><td>{html.escape(x['unit_price'])}</td>"
                        f"<td>{html.escape(x['quantity'])}</td><td>{html.escape(x['date'] or '')}</td></tr>"
                        for x in d["price_history"])
                    body.append(f"""<div class='card'><h3>{html.escape(d['name'])}</h3>
                      <div class='kv'><div>Transactions</div><div>{d['transaction_count']}</div>
                      <div>Posted invoices</div><div>{d['posted_invoices']}</div></div>
                      <h4>Price history</h4><table>
                      <tr><th>Item</th><th>Unit price</th><th>Qty</th><th>Date</th></tr>{hist}</table></div>""")
                elif kind == "vendor":
                    d = masterdata.vendor_profile(conn, detail_id)
                    hist = "".join(
                        f"<tr><td>{html.escape(x['item'] or '')}</td><td>{html.escape(x['component'])}</td>"
                        f"<td>{html.escape(x['amount'])}</td><td>{html.escape(x['vendor_bill'] or '')}</td></tr>"
                        for x in d["cost_history"])
                    body.append(f"""<div class='card'><h3>{html.escape(d['name'])}</h3>
                      <h4>Cost history</h4><table>
                      <tr><th>Item</th><th>Component</th><th>Amount</th><th>Vendor bill</th></tr>{hist}</table></div>""")
                else:
                    d = masterdata.product_profile(conn, detail_id)
                    al = ", ".join(f"{a['alias_type']}={a['alias_value']}" for a in d["aliases"]) or "—"
                    sales = "".join(
                        f"<tr><td>{html.escape(x['unit_price'])}</td><td>{html.escape(x['quantity'])}</td>"
                        f"<td>{html.escape(x['customer'] or '')}</td><td>{html.escape(x['date'] or '')}</td></tr>"
                        for x in d["price_history"])
                    costs = "".join(
                        f"<tr><td>{html.escape(x['product_cost'])}</td><td>{html.escape(x['date'] or '')}</td></tr>"
                        for x in d["cost_history"])
                    rng = d["price_range"]
                    body.append(f"""<div class='card'><h3>{html.escape(d['name'])}</h3>
                      <div class='kv'><div>Aliases</div><div>{html.escape(al)}</div>
                      <div>Price range</div><div>{html.escape(f"{rng['low']} - {rng['high']}" if rng else '—')}</div></div>
                      <h4>Price history</h4><table><tr><th>Unit price</th><th>Qty</th><th>Customer</th><th>Date</th></tr>{sales}</table>
                      <h4>Cost history</h4><table><tr><th>Product cost</th><th>Date</th></tr>{costs}</table></div>""")
            except KeyError:
                body.append("<div class='card'>Record not found.</div>")
        return _page("Master data", "".join(body))

    def page_periods(self, conn, q):
        rows = []
        for p in _periods(conn):
            per = periods.get(conn, p["id"])
            hist = periods.history(conn, p["id"])
            actions = []
            nxt = {"open": "under_review", "under_review": "verified", "verified": "locked"}.get(per.state)
            if nxt:
                actions.append(
                    f"<form method='post' action='/period' style='display:inline'>"
                    f"<input type='hidden' name='period' value='{html.escape(per.id)}'>"
                    f"<input type='hidden' name='to' value='{nxt}'>"
                    f"<input type='hidden' name='actor' value='operator'>"
                    f"<input type='submit' value='Move to {nxt.replace('_',' ')}'></form>")
            if per.state == "locked":
                actions.append(
                    f"<form method='post' action='/period' onsubmit=\"return confirm('Reopen this locked period?');\">"
                    f"<input type='hidden' name='period' value='{html.escape(per.id)}'>"
                    f"<input type='hidden' name='to' value='reopen'>"
                    f"<input type='text' name='reason' placeholder='written reason' required> "
                    f"<input type='text' name='actor' placeholder='authorized by' required> "
                    f"<button class='warn' type='submit'>Reopen</button></form>")
            rows.append(f"<tr><td>{html.escape(per.label)}</td><td><b>{html.escape(per.state)}</b></td>"
                        f"<td>{len(hist)} transition(s)</td><td>{''.join(actions)}</td></tr>")
        table = "".join(rows) or "<tr><td colspan=4 class='muted'>No periods yet.</td></tr>"
        return _page("Periods", f"{_flash(q)}<div class='card'><h3>Reporting periods</h3>"
                     f"<table><tr><th>Period</th><th>State</th><th>History</th><th>Actions</th></tr>"
                     f"{table}</table><p class='muted'>A period must be verified before locking. "
                     f"Reopening a locked period requires an authorizer and a written reason; both are audited.</p></div>")

    def page_config(self, conn, q):
        config_mod.bootstrap(conn)
        settings = config_mod.all_settings(conn)
        srows = "".join(
            f"""<tr><td>{html.escape(k)}</td><td>
              <form method='post' action='/config' style='display:flex;gap:6px'>
                <input type='hidden' name='what' value='setting'>
                <input type='hidden' name='key' value='{html.escape(k)}'>
                <input type='text' name='value' value='{html.escape(v)}'>
                <input type='submit' value='Save'></form></td></tr>""" for k, v in settings.items())
        rules = "".join(
            f"<tr><td>{html.escape(r['source_code'] or '')}</td><td>{html.escape(r['name'])}</td>"
            f"<td>{html.escape(r['basis'])}</td><td>{html.escape(r['rate_canonical'])}</td>"
            f"<td>v{r['version']}</td></tr>" for r in config_mod.commission_rules(conn))
        pol = "".join(
            f"<tr><td>{html.escape(p['name'])}</td><td>v{p['version']}</td>"
            f"<td>{'active' if p['active'] else 'historical'}</td>"
            f"<td class='muted'>{html.escape(p['created_at'])}</td></tr>"
            for p in config_mod.policy_history(conn))
        acc = config_mod.evidence_acceptance(conn, DEFAULT_POLICY.key())
        opts = lambda cur: "".join(
            f"<option{' selected' if s2 == cur else ''}>{s2}</option>"
            for s2 in ("verified", "provisional", "rejected"))
        arows = "".join(
            f"""<tr><td>{html.escape(t)}</td><td>
              <form method='post' action='/config' style='display:flex;gap:6px'>
                <input type='hidden' name='what' value='evidence'>
                <input type='hidden' name='type' value='{html.escape(t)}'>
                <select name='satisfies'>{opts(v)}</select>
                <input type='submit' value='Save'></form></td></tr>""" for t, v in acc.items())
        return _page("Configuration", f"""{_flash(q)}
          <div class='card'><h3>Settings</h3><table><tr><th>Key</th><th>Value</th></tr>{srows}</table></div>
          <div class='card'><h3>Commission rules (active)</h3>
            <table><tr><th>Code</th><th>Name</th><th>Basis</th><th>Rate</th><th>Version</th></tr>{rules}</table>
            <h4>Add / supersede a rule</h4>
            <form method='post' action='/config'>
              <input type='hidden' name='what' value='rule'>
              <input type='text' name='code' placeholder='code e.g. CR-GP10' required>
              <input type='text' name='name' placeholder='name' required>
              <select name='basis'><option>gross_profit</option><option>revenue</option></select>
              <input type='text' name='rate' placeholder='rate e.g. 0.10 or 10%' required>
              <input type='submit' value='Save new version'></form>
            <p class='muted'>Saving supersedes the current version; prior versions are retained so
            historical commission results stay explicable.</p></div>
          <div class='card'><h3>Calculation policy versions</h3>
            <table><tr><th>Policy</th><th>Version</th><th>State</th><th>Recorded</th></tr>{pol}</table>
            <p class='muted'>Historical policy versions are never edited — a change records a new
            version so existing calculation snapshots stay reproducible.</p></div>
          <div class='card'><h3>Cost-evidence acceptance</h3>
            <table><tr><th>Evidence type</th><th>Satisfies</th></tr>{arows}</table></div>""")

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
        q = urllib.parse.quote(batch)
        try:
            res = pipeline.post(conn, batch, DEFAULT_POLICY)
            period = (conn.execute("SELECT reporting_period_id FROM transactions WHERE import_batch_id=? LIMIT 1",
                                   (batch,)).fetchone() or {"reporting_period_id": None})["reporting_period_id"]
            pipeline.run_reconciliation(conn, period, batch)
            msg = (f"Posted {res['posted_transactions']} transaction(s); "
                   f"{res['snapshots_created']} calculation snapshots recorded.")
            return f"/batch?id={q}&ok={urllib.parse.quote(msg)}"
        except ValueError as e:
            # Surface the refusal with corrective guidance instead of failing silently.
            return f"/batch?id={q}&err={urllib.parse.quote(str(e))}"

    def act_rollback(self, conn, form):
        batch = form.get("batch", "")
        try:
            imports.rollback_batch(conn, batch)
            return "/?ok=" + urllib.parse.quote("Batch rolled back; staged rows discarded.")
        except ValueError as e:
            return f"/batch?id={urllib.parse.quote(batch)}&err={urllib.parse.quote(str(e))}"

    def act_resolve(self, conn, form):
        try:
            res = resolution.supply_cost_evidence(
                conn, form.get("exception_id", ""), product_cost=form.get("product_cost", "0"),
                policy=DEFAULT_POLICY, matrix=EvidenceMatrix(),
                vendor_bill_number=form.get("vendor_bill") or None)
            msg = (f"Evidence recorded: {len(res['resolved_exceptions'])} exception(s) resolved, "
                   f"{res['new_snapshots']} new snapshots (prior history preserved).")
            return "/exceptions?ok=" + urllib.parse.quote(msg)
        except (KeyError, ValueError, ArithmeticError) as e:
            return "/exceptions?err=" + urllib.parse.quote(
                f"Could not record evidence: {e}. Check the cost value (e.g. 90.00).")

    def act_period(self, conn, form):
        pid, to = form.get("period", ""), form.get("to", "")
        try:
            if to == "reopen":
                periods.reopen(conn, pid, reason=form.get("reason", ""),
                               authorized_by=form.get("actor", ""))
                msg = "Period reopened; the authorization and reason are recorded in the audit log."
            else:
                periods.transition(conn, pid, to, actor=form.get("actor") or "operator",
                                   reason=form.get("reason"))
                msg = f"Period moved to '{to}'."
            return "/periods?ok=" + urllib.parse.quote(msg)
        except periods.PeriodError as e:
            return "/periods?err=" + urllib.parse.quote(str(e))

    def act_config(self, conn, form):
        what = form.get("what")
        try:
            if what == "setting":
                config_mod.set_setting(conn, form.get("key", ""), form.get("value", ""),
                                       actor="operator")
                msg = f"Setting '{form.get('key')}' saved."
            elif what == "rule":
                config_mod.upsert_commission_rule(
                    conn, source_code=form.get("code", ""), name=form.get("name", ""),
                    basis=form.get("basis", "gross_profit"), rate=form.get("rate", "0"),
                    actor="operator")
                msg = "Commission rule saved as a new version (prior version retained)."
            elif what == "evidence":
                config_mod.set_evidence_acceptance(
                    conn, DEFAULT_POLICY.key(), form.get("type", ""),
                    form.get("satisfies", "provisional"), actor="operator")
                msg = "Evidence acceptance updated."
            else:
                return "/config?err=" + urllib.parse.quote("unknown configuration action")
            return "/config?ok=" + urllib.parse.quote(msg)
        except (KeyError, ValueError) as e:
            return "/config?err=" + urllib.parse.quote(str(e))

    def act_backup(self, conn, form):
        conn.commit()
        dest = Path(self.server.db_path).parent / f"backup-{utcnow_iso().replace(':','').replace('-','')}.db"
        backup_mod.create_backup(conn, dest)
        rep = backup_mod.validate_backup(dest)
        after = form.get("after", "/")
        sep = "&" if "?" in after else "?"
        if rep.ok:
            return f"{after}{sep}ok=" + urllib.parse.quote(f"Backup written and validated: {rep.summary()}")
        return f"{after}{sep}err=" + urllib.parse.quote(f"Backup FAILED validation: {rep.problems}")


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
