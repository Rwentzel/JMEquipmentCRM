"""Exchange 2.1: report-scope isolation — no cross-batch/period contamination."""

import unittest

from finance_system import batch_report
from finance_system.policies import DEFAULT_POLICY
from finance_system.scope import ReportScope
from tests.helpers import (
    fresh_db, import_fixture, import_content, make_period, seed_rules, SMALL_CSV, FIXTURE,
)


class TestScope(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()

    def tearDown(self):
        self.conn.close()

    def test_all_time_requires_explicit_scope(self):
        s = ReportScope(DEFAULT_POLICY.name, DEFAULT_POLICY.version)  # no period, all_time False
        with self.assertRaises(ValueError):
            s.validate()
        ReportScope.all_time_scope(DEFAULT_POLICY).validate()  # explicit all-time is fine

    def test_two_batches_one_period_do_not_contaminate(self):
        rules = seed_rules(self.conn)
        pid = make_period(self.conn)
        b1 = import_content(self.conn, FIXTURE.read_bytes(), period_id=pid, rules=rules,
                            filename="big.csv")
        b2 = import_content(self.conn, SMALL_CSV, period_id=pid, rules=rules, filename="small.csv")
        r1 = batch_report.build_report(self.conn, ReportScope.for_batch(pid, b1, DEFAULT_POLICY), DEFAULT_POLICY)
        r2 = batch_report.build_report(self.conn, ReportScope.for_batch(pid, b2, DEFAULT_POLICY), DEFAULT_POLICY)
        rp = batch_report.build_report(self.conn, ReportScope.for_period(pid, DEFAULT_POLICY), DEFAULT_POLICY)
        self.assertEqual(r1["A_intake"]["rows_staged"], 15)
        self.assertEqual(r2["A_intake"]["rows_staged"], 4)
        self.assertEqual(rp["A_intake"]["rows_staged"], 19)  # period = both batches
        # batch-scoped exceptions never include the other batch's
        self.assertLessEqual(r1["A_intake"]["exceptions"], rp["A_intake"]["exceptions"])
        self.assertLess(r2["A_intake"]["exceptions"], rp["A_intake"]["exceptions"])

    def test_two_periods_do_not_contaminate(self):
        rules = seed_rules(self.conn)
        p1 = make_period(self.conn, "2026-06", "2026-06-01", "2026-06-30")
        p2 = make_period(self.conn, "2026-07", "2026-07-01", "2026-07-31")
        import_content(self.conn, SMALL_CSV, period_id=p1, rules=rules)
        import_fixture(self.conn, period_id=p2, post=True)  # seeds its own rules? uses seed_rules again
        rp1 = batch_report.build_report(self.conn, ReportScope.for_period(p1, DEFAULT_POLICY), DEFAULT_POLICY)
        rp2 = batch_report.build_report(self.conn, ReportScope.for_period(p2, DEFAULT_POLICY), DEFAULT_POLICY)
        self.assertEqual(rp1["A_intake"]["rows_staged"], 4)
        self.assertEqual(rp2["A_intake"]["rows_staged"], 15)

    def test_historical_exceptions_do_not_inflate_batch_report(self):
        rules = seed_rules(self.conn)
        pid = make_period(self.conn)
        b1 = import_content(self.conn, FIXTURE.read_bytes(), period_id=pid, rules=rules, filename="a.csv")
        b2 = import_content(self.conn, SMALL_CSV, period_id=pid, rules=rules, filename="b.csv")
        r_all = batch_report.build_report(self.conn, ReportScope.all_time_scope(DEFAULT_POLICY), DEFAULT_POLICY)
        r_b2 = batch_report.build_report(self.conn, ReportScope.for_batch(pid, b2, DEFAULT_POLICY), DEFAULT_POLICY)
        self.assertLess(r_b2["A_intake"]["exceptions"], r_all["A_intake"]["exceptions"])
        self.assertLess(r_b2["A_intake"]["conflicts"], r_all["A_intake"]["conflicts"] + 1)


if __name__ == "__main__":
    unittest.main()
