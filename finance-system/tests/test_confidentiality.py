"""Confidentiality controls for Exchange 2 (scanner, gitignore, redaction).

SCANNER-ALLOW-TEST-VECTORS: this file intentionally contains fake secrets/PII as detection
test vectors; the repository-level path scan skips this file's content while the unit tests
below still exercise detection via scan_text directly.
"""

import subprocess
import unittest
from pathlib import Path

from finance_system import scanner

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent


class TestConfidentiality(unittest.TestCase):
    def test_scanner_detects_seeded_high_risk(self):
        seeded = "customer bank routing number: 021000021 and ssn 123-45-6789"
        findings = scanner.scan_text("seed", seeded)
        kinds = {f.kind for f in findings}
        self.assertTrue({"ssn"} & kinds or {"bank_account"} & kinds)

    def test_scanner_excerpt_not_printed_by_safety_script(self):
        # The human safety-scan output must not echo matched confidential text.
        script = ROOT / "scripts" / "safety_scan.py"
        out = subprocess.run(["python3", str(script), "--all"], cwd=REPO_ROOT,
                             capture_output=True, text=True)
        combined = out.stdout + out.stderr
        self.assertNotIn("123-45-6789", combined)
        self.assertNotIn("BEGIN RSA PRIVATE KEY", combined)

    def test_gitignore_blocks_private_and_data(self):
        gi = (ROOT / ".gitignore").read_text()
        for pat in (".data/", "private/", "*.db", "*.xlsx"):
            self.assertIn(pat, gi)

    def test_export_dir_is_under_gitignored_data(self):
        from finance_system.export import default_export_root
        from finance_system.db import data_dir
        self.assertTrue(str(default_export_root()).startswith(str(data_dir())))

    def test_no_real_data_fixture_tracked(self):
        # All tracked fixtures are sanitized (fabricated) — assert none is flagged high.
        fixtures = list((ROOT / "fixtures").glob("*"))
        report = scanner.scan_paths(fixtures)
        self.assertTrue(report.ok, f"unexpected high findings: {report.high}")


if __name__ == "__main__":
    unittest.main()
