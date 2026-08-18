"""Reporting-period lifecycle + transaction traceability."""

import unittest

from finance_system import explain, periods, pipeline
from finance_system.audit import recent
from finance_system.policies import DEFAULT_POLICY
from tests.helpers import fresh_db, import_fixture, make_profile, seed_rules, FIXTURE
from finance_system.evidence import EvidenceMatrix


class TestPeriodLifecycle(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.pid = periods.create_period(self.conn, "2026-06", "2026-06-01", "2026-06-30",
                                         actor="operator")

    def tearDown(self):
        self.conn.close()

    def test_normal_close_sequence(self):
        self.assertEqual(periods.get(self.conn, self.pid).state, periods.OPEN)
        periods.transition(self.conn, self.pid, periods.UNDER_REVIEW, actor="op")
        periods.transition(self.conn, self.pid, periods.VERIFIED, actor="op")
        p = periods.lock(self.conn, self.pid, actor="op")
        self.assertEqual(p.state, periods.LOCKED)
        self.assertEqual(p.locked, 1)

    def test_cannot_lock_before_verified(self):
        with self.assertRaises(periods.PeriodError) as ctx:
            periods.lock(self.conn, self.pid, actor="op")
        self.assertIn("verified", str(ctx.exception))

    def test_cannot_skip_states(self):
        with self.assertRaises(periods.PeriodError):
            periods.transition(self.conn, self.pid, periods.LOCKED, actor="op")

    def test_reopen_requires_authorizer_and_reason(self):
        periods.transition(self.conn, self.pid, periods.UNDER_REVIEW, actor="op")
        periods.transition(self.conn, self.pid, periods.VERIFIED, actor="op")
        periods.lock(self.conn, self.pid, actor="op")
        with self.assertRaises(periods.PeriodError):
            periods.reopen(self.conn, self.pid, reason="   ", authorized_by="op")
        with self.assertRaises(periods.PeriodError):
            periods.reopen(self.conn, self.pid, reason="late bill", authorized_by="")
        p = periods.reopen(self.conn, self.pid, reason="late vendor bill", authorized_by="riley")
        self.assertEqual(p.state, periods.OPEN)
        self.assertEqual(p.locked, 0)

    def test_every_transition_is_recorded_and_audited(self):
        periods.transition(self.conn, self.pid, periods.UNDER_REVIEW, actor="op")
        periods.transition(self.conn, self.pid, periods.VERIFIED, actor="op")
        periods.lock(self.conn, self.pid, actor="op")
        periods.reopen(self.conn, self.pid, reason="correction", authorized_by="riley")
        hist = periods.history(self.conn, self.pid)
        self.assertEqual([h["to_state"] for h in hist],
                         ["open", "under_review", "verified", "locked", "open"])
        reopen_row = hist[-1]
        self.assertEqual(reopen_row["authorized_by"], "riley")
        self.assertIn("correction", reopen_row["reason"])
        self.assertIn("period_transition", [e["kind"] for e in recent(self.conn, 100)])

    def test_locked_period_blocks_posting(self):
        rules = seed_rules(self.conn)
        periods.transition(self.conn, self.pid, periods.UNDER_REVIEW, actor="op")
        periods.transition(self.conn, self.pid, periods.VERIFIED, actor="op")
        periods.lock(self.conn, self.pid, actor="op")
        out = pipeline.register_and_stage(
            self.conn, filename="x.csv", content=FIXTURE.read_bytes(), profile=make_profile(),
            matrix=EvidenceMatrix(), policy=DEFAULT_POLICY, period_id=self.pid, rule_lookup=rules)
        with self.assertRaises(ValueError):
            pipeline.post(self.conn, out.batch_id, DEFAULT_POLICY)


class TestExplain(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch, self.pid = import_fixture(self.conn, post=True)
        self.txn = self.conn.execute(
            "SELECT entity_id FROM external_identifiers WHERE value='INV-2001' LIMIT 1").fetchone()[0]

    def tearDown(self):
        self.conn.close()

    def test_explain_shows_snapshot_inputs(self):
        d = explain.explain_transaction(self.conn, self.txn)
        gp = d["lines"][0]["current_snapshots"]["gross_profit"]
        self.assertIn("net_revenue", gp["inputs"])
        self.assertIn("total_cost", gp["inputs"])
        self.assertTrue(gp["policy"])
        self.assertTrue(gp["formula_version"])

    def test_explain_includes_verification_costs_and_source_row(self):
        d = explain.explain_transaction(self.conn, self.txn)
        line = d["lines"][0]
        self.assertIn("revenue", line["verification_by_calculation"])
        self.assertTrue(line["costs"])
        self.assertIsNotNone(line["source_row"])          # original row preserved
        self.assertIn("raw", line["source_row"])

    def test_explain_reports_cash_status_for_invoices(self):
        d = explain.explain_transaction(self.conn, self.txn)
        self.assertIsNotNone(d["cash_application"])
        self.assertIn(d["cash_application"]["status"], ("open", "partially_paid", "paid", "overpaid"))

    def test_unknown_transaction_raises(self):
        with self.assertRaises(KeyError):
            explain.explain_transaction(self.conn, "txn_nope")

    def test_find_by_invoice_customer_and_item(self):
        self.assertTrue(explain.find_transactions(self.conn, "INV-2001"))
        self.assertTrue(explain.find_transactions(self.conn, "Northwind"))
        self.assertTrue(explain.find_transactions(self.conn, "Sample Bearing"))
        self.assertEqual(explain.find_transactions(self.conn, "zzz-no-such-thing"), [])


if __name__ == "__main__":
    unittest.main()
