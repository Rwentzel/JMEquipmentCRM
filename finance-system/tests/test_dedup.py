"""Duplicate and conflict detection; override; idempotent re-import."""

import unittest

from finance_system import dedup, pipeline
from finance_system.evidence import EvidenceMatrix
from finance_system.policies import DEFAULT_POLICY
from tests.helpers import fresh_db, import_fixture, make_profile, make_period, seed_rules, FIXTURE


class TestDedup(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()

    def tearDown(self):
        self.conn.close()

    def test_likely_duplicate_detected_not_merged(self):
        batch_id, _ = import_fixture(self.conn, post=False)
        likely = dedup.find_likely_duplicates(self.conn, batch_id)
        self.assertTrue(likely)  # rows 13 & 14 are near-identical
        # nothing merged: both transactions still exist
        n = self.conn.execute("SELECT COUNT(*) FROM transactions WHERE import_batch_id=?",
                              (batch_id,)).fetchone()[0]
        self.assertEqual(n, 15)

    def test_conflicting_invoice_number(self):
        batch_id, _ = import_fixture(self.conn, post=False)
        pipeline.analyze(self.conn, batch_id)
        rows = self.conn.execute(
            "SELECT rule FROM reconciliation_findings WHERE finding_type='conflict'").fetchall()
        rules = {r["rule"] for r in rows}
        self.assertIn("invoice_customer_mismatch", rules)  # INV-2001 two customers

    def test_exact_duplicate_reimport_rejected(self):
        # first import posted
        import_fixture(self.conn, post=True)
        # second import of identical content
        rules = seed_rules(self.conn)
        pid = make_period(self.conn, label="2026-07", start="2026-07-01", end="2026-07-31")
        out = pipeline.register_and_stage(
            self.conn, filename="sample_month_v2.csv", content=FIXTURE.read_bytes(),
            profile=make_profile(), matrix=EvidenceMatrix(), policy=DEFAULT_POLICY,
            period_id=pid, rule_lookup=rules)
        analysis = pipeline.analyze(self.conn, out.batch_id)
        self.assertTrue(analysis.exact_duplicates)
        posted = pipeline.post(self.conn, out.batch_id, DEFAULT_POLICY)
        self.assertEqual(posted["posted_transactions"], 0)  # all rejected as exact dups

    def test_override_allows_duplicate_post(self):
        import_fixture(self.conn, post=True)
        rules = seed_rules(self.conn)
        pid = make_period(self.conn, label="2026-08", start="2026-08-01", end="2026-08-31")
        out = pipeline.register_and_stage(
            self.conn, filename="sample_month_v2.csv", content=FIXTURE.read_bytes(),
            profile=make_profile(), matrix=EvidenceMatrix(), policy=DEFAULT_POLICY,
            period_id=pid, rule_lookup=rules)
        pipeline.analyze(self.conn, out.batch_id, allow_duplicates=True,
                         override_reason="authorized correction")
        posted = pipeline.post(self.conn, out.batch_id, DEFAULT_POLICY)
        self.assertGreater(posted["posted_transactions"], 0)
        overrides = self.conn.execute("SELECT COUNT(*) FROM override_authorizations").fetchone()[0]
        self.assertGreater(overrides, 0)


if __name__ == "__main__":
    unittest.main()
