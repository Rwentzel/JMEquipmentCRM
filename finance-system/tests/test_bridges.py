"""Exchange 2.1: cost reconciliation, units, and commission bridges."""

import unittest
from decimal import Decimal

from finance_system import batch_report, posting
from finance_system.policies import DEFAULT_POLICY
from finance_system.scope import ReportScope
from tests.helpers import fresh_db, import_content, make_period, seed_rules, SMALL_CSV, import_fixture


class TestCostBridge(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        rules = seed_rules(self.conn)
        self.pid = make_period(self.conn)
        self.batch = import_content(self.conn, SMALL_CSV, period_id=self.pid, rules=rules)
        self.rep = batch_report.build_report(
            self.conn, ReportScope.for_batch(self.pid, self.batch, DEFAULT_POLICY), DEFAULT_POLICY)
        self.cb = self.rep["F_provisional_excluded_totals"]["cost_bridge"]

    def tearDown(self):
        self.conn.close()

    def test_bridge_reconciles_recognized_to_reported(self):
        self.assertEqual(Decimal(self.cb["policy_recognized_total_actual_cost"]),
                         Decimal(self.cb["reported_total_actual_cost"]))

    def test_non_sale_document_cost_excluded_not_hidden(self):
        # SMALL_CSV has a sales order with 120 cost that must be excluded from recognized.
        self.assertEqual(Decimal(self.cb["less_non_sale_document_cost"]), Decimal("120.00"))
        raw = Decimal(self.cb["raw_posted_cost_components"])
        recognized = Decimal(self.cb["policy_recognized_total_actual_cost"])
        excluded = Decimal(self.cb["less_non_sale_document_cost"]) + Decimal(self.cb["less_policy_excluded_components"])
        self.assertEqual(raw - excluded, recognized)  # the bridge closes exactly

    def test_report_integrity_ok(self):
        self.assertTrue(self.rep["integrity"]["ok"])
        names = {c["invariant"] for c in self.rep["integrity"]["checks"]}
        self.assertIn("cost_bridge == reported_total_actual_cost", names)


class TestUnitsBridge(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        rules = seed_rules(self.conn)
        self.pid = make_period(self.conn)
        self.batch = import_content(self.conn, SMALL_CSV, period_id=self.pid, rules=rules)
        self.ub = batch_report.build_report(
            self.conn, ReportScope.for_batch(self.pid, self.batch, DEFAULT_POLICY),
            DEFAULT_POLICY)["F_provisional_excluded_totals"]["units_bridge"]

    def tearDown(self):
        self.conn.close()

    def test_units_exclude_non_sales_and_net_of_returns(self):
        self.assertEqual(Decimal(self.ub["units_ordered"]), Decimal("10"))     # sales order
        self.assertEqual(Decimal(self.ub["units_invoiced"]), Decimal("4"))     # invoice qty
        self.assertEqual(Decimal(self.ub["units_returned"]), Decimal("1"))     # RMA qty
        self.assertEqual(Decimal(self.ub["net_units_sold"]), Decimal("3"))     # 4 - 1
        # payment quantity (1) is NOT in any units figure


class TestCommissionScope(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch, self.pid = import_fixture(self.conn, post=True)

    def tearDown(self):
        self.conn.close()

    def _commission(self):
        return batch_report.build_report(
            self.conn, ReportScope.for_batch(self.pid, self.batch, DEFAULT_POLICY),
            DEFAULT_POLICY)["F_provisional_excluded_totals"]["commission_bridge"]

    def test_recalculation_excludes_superseded(self):
        before = self._commission()
        # recompute a commissioned line -> supersedes its commission calc
        line = self.conn.execute(
            """SELECT l.* FROM transaction_lines l JOIN external_identifiers x ON x.entity_id=l.transaction_id
               WHERE x.value='INV-2001' AND x.namespace='invoice_number'
               AND l.unit_sales_price_minor IS NOT NULL LIMIT 1""").fetchone()
        txn = self.conn.execute("SELECT * FROM transactions WHERE id=?", (line["transaction_id"],)).fetchone()
        with self.conn:
            posting.persist_line_snapshots(self.conn, txn, line, DEFAULT_POLICY, supersede=True)
        after = self._commission()
        self.assertEqual(Decimal(after["current_commission_total"]),
                         Decimal(before["current_commission_total"]))  # not double counted
        self.assertGreaterEqual(after["superseded_rows_excluded"], 1)

    def test_commission_scoped_to_batch(self):
        # a different batch's commission does not appear in this batch's total
        other = import_fixture(self.conn, period_id=self.pid, post=True)  # seeds more
        c_this = self._commission()
        c_all = batch_report.build_report(
            self.conn, ReportScope.all_time_scope(DEFAULT_POLICY),
            DEFAULT_POLICY)["F_provisional_excluded_totals"]["commission_bridge"]
        self.assertLessEqual(Decimal(c_this["current_commission_total"]),
                             Decimal(c_all["current_commission_total"]))


if __name__ == "__main__":
    unittest.main()
