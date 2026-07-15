"""Confidential-data scanner: detects secrets/PII; exempts sanitized fixtures for values.

SCANNER-ALLOW-TEST-VECTORS: this file intentionally contains fake secrets/PII as detection
test vectors. The repository-level path scan skips this file's content; unit tests below call
scan_text directly so core detection is still fully exercised.
"""

import unittest

from finance_system.scanner import scan_text, scan_paths, Finding
from pathlib import Path


class TestScanner(unittest.TestCase):
    def _kinds(self, findings):
        return {f.kind for f in findings}

    def test_detects_ssn_and_credentials(self):
        findings = scan_text("x", "ssn 123-45-6789\napi_key = ABC123SECRET")
        kinds = self._kinds(findings)
        self.assertIn("ssn", kinds)
        self.assertIn("credential", kinds)
        self.assertTrue(all(f.severity == "high" for f in findings if f.kind in ("ssn", "credential")))

    def test_detects_suspicious_email_but_allows_example(self):
        bad = scan_text("x", "contact real.person@acmecorp.com")
        self.assertIn("email_pii", self._kinds(bad))
        good = scan_text("x", "contact sample.rep@example.com")
        self.assertNotIn("email_pii", self._kinds(good))

    def test_currency_flagged_unless_sanitized_fixture(self):
        plain = scan_text("x", "line total $1,250.00")
        self.assertIn("currency_amount", self._kinds(plain))
        fixture = scan_text("x", "line total $1,250.00", is_sanitized_fixture=True)
        self.assertNotIn("currency_amount", self._kinds(fixture))

    def test_credentials_still_checked_in_fixtures(self):
        # Value heuristics are skipped for fixtures, but secrets never are.
        findings = scan_text("x", "password = hunter2", is_sanitized_fixture=True)
        self.assertIn("credential", self._kinds(findings))

    def test_scan_real_fixture_is_clean(self):
        fixture = Path(__file__).resolve().parent.parent / "fixtures" / "sample_month.json"
        report = scan_paths([fixture])
        self.assertTrue(report.ok, f"unexpected high findings: {report.high}")

    def test_report_ok_only_without_high(self):
        report = scan_paths([])
        self.assertTrue(report.ok)
        report.findings.append(Finding("x", "ssn", "high", 1, "..."))
        self.assertFalse(report.ok)


if __name__ == "__main__":
    unittest.main()
