"""CLI workflow: exit codes, locked-period refusal, dry-run."""

import io
import unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from tempfile import TemporaryDirectory

from finance_system import cli

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "sample_month_v2.csv"


def run(argv):
    out = io.StringIO()
    err = io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = cli.main(argv)
    return code, out.getvalue() + err.getvalue()


class TestCli(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.db = str(Path(self.tmp.name) / "finance.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_initialize_and_import_dry_run(self):
        code, _ = run(["--db", self.db, "initialize"])
        self.assertEqual(code, 0)
        code, text = run(["--db", self.db, "import", str(FIXTURE), "--period", "2026-06", "--dry-run"])
        self.assertEqual(code, 0)
        self.assertIn("rolled back", text)

    def test_import_and_post_then_report(self):
        run(["--db", self.db, "initialize"])
        code, _ = run(["--db", self.db, "import", str(FIXTURE), "--period", "2026-06", "--post"])
        self.assertEqual(code, 0)
        code, text = run(["--db", self.db, "report", "--period", "2026-06"])
        self.assertEqual(code, 0)
        self.assertIn("E_verified_totals", text)

    def test_safety_scan_exit_code(self):
        code, _ = run(["--db", self.db, "safety-scan"])
        self.assertEqual(code, 0)  # no high findings in the tree


if __name__ == "__main__":
    unittest.main()
