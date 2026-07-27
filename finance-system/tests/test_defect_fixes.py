"""Regression tests for defects found in the post-release code sweep."""

import unittest
from decimal import Decimal

from finance_system import batch_report, conflicts, dedup, pipeline
from finance_system.money import Money
from finance_system.policies import DEFAULT_POLICY
from finance_system.scope import ReportScope
from tests.helpers import (
    fresh_db, import_content, import_fixture, make_period, seed_rules, SMALL_CSV, FIXTURE,
)


class TestMoneyExactnessInDedup(unittest.TestCase):
    """dedup must not use binary floating point for monetary comparison (ADR-0003)."""

    def setUp(self):
        self.conn = fresh_db()

    def tearDown(self):
        self.conn.close()

    def test_extended_amount_is_exact_integer_minor(self):
        # 0.1 x 3 is the classic float trap: 0.1*3 == 0.30000000000000004 in binary float.
        self.conn.execute(
            "INSERT INTO transactions(id, transaction_type, created_at) VALUES ('t1','invoice','t')")
        self.conn.execute(
            """INSERT INTO transaction_lines(id, transaction_id, quantity_minor,
               unit_sales_price_minor, currency, created_at)
               VALUES ('l1','t1',?,?,'USD','t')""",
            (30000, Money.of("0.10").minor))          # qty 3.0 x $0.10 = $0.30 exactly
        amt = dedup._line_amount_minor(self.conn, "t1")
        self.assertEqual(amt, Money.of("0.30").minor)
        self.assertEqual(Money.from_minor(amt).as_decimal(), Decimal("0.3000"))

    def test_identical_documents_compare_equal(self):
        for tid in ("a", "b"):
            self.conn.execute(
                f"INSERT INTO transactions(id, transaction_type, created_at) VALUES ('{tid}','invoice','t')")
            self.conn.execute(
                """INSERT INTO transaction_lines(id, transaction_id, quantity_minor,
                   unit_sales_price_minor, currency, created_at) VALUES (?,?,?,?,'USD','t')""",
                (f"l{tid}", tid, 70000, Money.of("1.15").minor))
        self.assertEqual(dedup._line_amount_minor(self.conn, "a"),
                         dedup._line_amount_minor(self.conn, "b"))


class TestDedupScoping(unittest.TestCase):
    """Likely-duplicate comparison is bounded to comparable periods, and terminates."""

    def setUp(self):
        self.conn = fresh_db()

    def tearDown(self):
        self.conn.close()

    def test_other_period_not_compared(self):
        rules = seed_rules(self.conn)
        p1 = make_period(self.conn, "2026-06", "2026-06-01", "2026-06-30")
        p2 = make_period(self.conn, "2026-07", "2026-07-01", "2026-07-31")
        import_content(self.conn, FIXTURE.read_bytes(), period_id=p1, rules=rules, filename="june.csv")
        b2 = import_content(self.conn, SMALL_CSV, period_id=p2, rules=rules, post=False,
                            filename="july.csv")
        likely = dedup.find_likely_duplicates(self.conn, b2)
        # Every candidate pair must stay inside the July period — June is a different window.
        p2_ids = {r[0] for r in self.conn.execute(
            "SELECT id FROM transactions WHERE reporting_period_id=?", (p2,))}
        for d in likely:
            self.assertIn(d.transaction_id, p2_ids)
            self.assertIn(d.other_transaction_id, p2_ids)

    def test_no_self_pairing_or_duplicate_pairs(self):
        batch, _ = import_fixture(self.conn, post=False)
        likely = dedup.find_likely_duplicates(self.conn, batch)
        seen = set()
        for d in likely:
            self.assertNotEqual(d.transaction_id, d.other_transaction_id)   # no self-pair
            key = frozenset((d.transaction_id, d.other_transaction_id))
            self.assertNotIn(key, seen)                                      # no mirrored dupes
            seen.add(key)


class TestConflictAndAnalytics(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch, self.pid = import_fixture(self.conn, post=True)
        self.scope = ReportScope.for_batch(self.pid, self.batch, DEFAULT_POLICY)

    def tearDown(self):
        self.conn.close()

    def test_commission_without_rule_is_flagged(self):
        rules = {r["rule"] for r in self.conn.execute(
            "SELECT rule FROM reconciliation_findings WHERE finding_type='conflict'")}
        # INV-2002 / INV-2003 carry revenue but no commission plan in the fixture.
        self.assertIn("commission_without_rule", rules)

    def test_top_customer_metric_is_computed_not_stubbed(self):
        rep = batch_report.build_report(self.conn, self.scope, DEFAULT_POLICY)
        h = rep["H_analytical"]
        self.assertGreater(h["top_customer_posted_txn_count"], 0)   # was hard-coded 0
        self.assertGreater(h["customers_in_scope"], 0)
        self.assertLessEqual(h["top_customer_posted_txn_count"], rep["A_intake"]["rows_posted"])


class TestCliScopeFallback(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()

    def tearDown(self):
        self.conn.close()

    def test_batch_scope_derives_period_when_not_given(self):
        from finance_system import cli
        batch, pid = import_fixture(self.conn, post=True)

        class Args:
            period = None
            batch = None
            all_time = False
        args = Args()
        args.batch = batch
        scope = cli._scope(self.conn, args)     # must not raise
        self.assertEqual(scope.import_batch_id, batch)
        self.assertEqual(scope.reporting_period_id, pid)

    def test_unknown_batch_raises_actionable_error(self):
        from finance_system import cli

        class Args:
            period = None
            batch = "batch_does_not_exist"
            all_time = False
        with self.assertRaises(ValueError) as ctx:
            cli._scope(self.conn, Args())
        self.assertIn("--period", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
