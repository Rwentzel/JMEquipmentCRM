"""Exchange 2.1: database connections are closed (no ResourceWarning leaks)."""

import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "fixtures" / "sample_month_v2.csv"


class TestLifecycle(unittest.TestCase):
    def _run(self, args, cwd):
        # -W error::ResourceWarning turns any unclosed-connection warning into a failure.
        return subprocess.run(
            [sys.executable, "-W", "error::ResourceWarning", "-m", "finance_system.cli", *args],
            cwd=ROOT, capture_output=True, text=True)

    def test_cli_commands_close_connections(self):
        with TemporaryDirectory() as tmp:
            db = str(Path(tmp) / "finance.db")
            for args in (["--db", db, "initialize"],
                         ["--db", db, "import", str(FIXTURE), "--period", "2026-06", "--post"],
                         ["--db", db, "report", "--period", "2026-06"],
                         ["--db", db, "backup", "--out", str(Path(tmp) / "b.db")]):
                r = self._run(args, tmp)
                self.assertNotIn("ResourceWarning", r.stderr, f"leak in {args}: {r.stderr}")
                self.assertIn(r.returncode, (0, 2, 3), f"unexpected exit for {args}: {r.stderr}")

    def test_demo_runs_without_connection_warnings(self):
        r = subprocess.run(
            [sys.executable, "-W", "error::ResourceWarning", "-m", "finance_system.demo"],
            cwd=ROOT, capture_output=True, text=True, timeout=180)
        self.assertEqual(r.returncode, 0, r.stderr[-500:])
        self.assertNotIn("ResourceWarning", r.stderr)


if __name__ == "__main__":
    unittest.main()
