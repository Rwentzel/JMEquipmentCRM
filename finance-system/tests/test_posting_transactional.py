"""Transactional posting: no partial post, locked-period refusal, idempotency."""

import unittest

from finance_system import pipeline, posting
from finance_system.evidence import EvidenceMatrix
from finance_system.policies import DEFAULT_POLICY
from tests.helpers import (
    fresh_db, import_fixture, make_profile, make_period, seed_rules, FIXTURE,
)


class TestPostingTransactional(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()

    def tearDown(self):
        self.conn.close()

    def test_locked_period_rejects_posting(self):
        rules = seed_rules(self.conn)
        pid = make_period(self.conn, locked=1)
        out = pipeline.register_and_stage(
            self.conn, filename="sample_month_v2.csv", content=FIXTURE.read_bytes(),
            profile=make_profile(), matrix=EvidenceMatrix(), policy=DEFAULT_POLICY,
            period_id=pid, rule_lookup=rules)
        with self.assertRaises(ValueError):
            pipeline.post(self.conn, out.batch_id, DEFAULT_POLICY)
        posted = self.conn.execute("SELECT COUNT(*) FROM transactions WHERE posted=1").fetchone()[0]
        self.assertEqual(posted, 0)  # nothing posted

    def test_posting_failure_is_atomic(self):
        # Force a failure mid-post by monkeypatching persist to raise on the 3rd line.
        batch_id, _ = import_fixture(self.conn, post=False)
        pipeline.analyze(self.conn, batch_id)
        original = posting.persist_line_snapshots
        calls = {"n": 0}

        def boom(conn, txn, line, policy, *, supersede=False):
            calls["n"] += 1
            if calls["n"] == 3:
                raise RuntimeError("simulated failure")
            return original(conn, txn, line, policy, supersede=supersede)

        posting.persist_line_snapshots = boom
        try:
            with self.assertRaises(RuntimeError):
                posting.post_batch(self.conn, batch_id, DEFAULT_POLICY)
        finally:
            posting.persist_line_snapshots = original
        # Transaction rolled back: nothing posted, no snapshots committed.
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM transactions WHERE posted=1").fetchone()[0], 0)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM calculation_snapshots").fetchone()[0], 0)

    def test_rejected_rows_remain_staged_and_visible(self):
        import_fixture(self.conn, post=True)
        rules = seed_rules(self.conn)
        pid = make_period(self.conn, label="2026-09", start="2026-09-01", end="2026-09-30")
        out = pipeline.register_and_stage(
            self.conn, filename="sample_month_v2.csv", content=FIXTURE.read_bytes(),
            profile=make_profile(), matrix=EvidenceMatrix(), policy=DEFAULT_POLICY,
            period_id=pid, rule_lookup=rules)
        pipeline.analyze(self.conn, out.batch_id)
        pipeline.post(self.conn, out.batch_id, DEFAULT_POLICY)
        rejected = self.conn.execute(
            "SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND review_status='rejected'",
            (out.batch_id,)).fetchone()[0]
        self.assertGreater(rejected, 0)  # still present, visible, not posted

    def test_post_is_idempotent(self):
        batch_id, _ = import_fixture(self.conn, post=True)
        second = pipeline.post(self.conn, batch_id, DEFAULT_POLICY)
        self.assertTrue(second["already_posted"])
        self.assertEqual(second["posted_transactions"], 0)


if __name__ == "__main__":
    unittest.main()
