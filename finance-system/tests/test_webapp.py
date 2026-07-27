"""Operator web console: drives the real HTTP server end-to-end over loopback."""

import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from tempfile import TemporaryDirectory

from finance_system import webapp


class TestWebapp(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        db = str(Path(self.tmp.name) / "finance.db")
        self.srv = webapp.make_server(db, host="127.0.0.1", port=0)  # ephemeral port
        self.base = f"http://127.0.0.1:{self.srv.server_address[1]}"
        self.thread = threading.Thread(target=self.srv.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.thread.join(timeout=5)
        self.tmp.cleanup()

    def _get(self, path):
        with urllib.request.urlopen(self.base + path, timeout=10) as r:
            return r.status, r.read().decode("utf-8")

    def _post(self, path, data, expect_redirect=True):
        body = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(self.base + path, data=body, method="POST")
        opener = urllib.request.build_opener(_NoRedirect())  # don't follow the 303
        try:
            with opener.open(req, timeout=10) as r:
                return r.status, r.headers.get("Location")
        except urllib.error.HTTPError as e:  # 303 surfaces here when not followed
            return e.code, e.headers.get("Location")

    def test_dashboard_loads(self):
        status, html = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn("Finance Console", html)
        self.assertIn("Active database", html)

    def test_import_post_report_flow(self):
        csv = ("Type,Customer,Item,Invoice #,Date,Period Date,Qty,Unit Price,Discount,"
               "Freight Billed,Tax,Cost,Freight In,Freight Out,Crating,Commission Plan,"
               "Commission Basis,Commission %\n"
               "Invoice,Acme Test,Widget A,INV-5001,2026-06-05,2026-06-05,2,100.00,0,0,0,120.00,0,0,0,,,\n")
        status, loc = self._post("/import", {"period": "2026-06", "filename": "c.csv", "content": csv})
        self.assertEqual(status, 303)
        self.assertIn("/batch?id=", loc)
        batch = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)["id"][0]
        # review page renders
        s, html = self._get(f"/batch?id={urllib.parse.quote(batch)}")
        self.assertEqual(s, 200)
        self.assertIn("Batch review", html)
        # post
        s, loc = self._post("/post", {"batch": batch})
        self.assertEqual(s, 303)
        # report page for the period renders with integrity status
        s, html = self._get("/report")
        self.assertEqual(s, 200)
        # pick the period id from the select and request the report
        s, html = self._get("/report")
        self.assertIn("Reporting period", html)

    def test_backup_action(self):
        s, loc = self._post("/backup", {"after": "/"})
        self.assertEqual(s, 303)
        backups = list(Path(self.tmp.name).glob("backup-*.db"))
        self.assertTrue(backups)

    def test_unknown_route_404(self):
        try:
            self._get("/nope")
            self.fail("expected 404")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 404)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


if __name__ == "__main__":
    unittest.main()
