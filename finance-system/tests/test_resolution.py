"""Evidence resolution: exception -> verified/provisional, history preserved, totals update."""

import unittest

from finance_system import resolution, snapshots
from finance_system.audit import recent
from finance_system.evidence import EvidenceMatrix
from finance_system.policies import DEFAULT_POLICY
from finance_system.reporting import compute_separated_totals
from finance_system.verification import CalculationType
from tests.helpers import fresh_db, import_fixture


class TestResolution(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch_id, self.period_id = import_fixture(self.conn, post=True)
        self.exc = self.conn.execute(
            """SELECT e.id, e.transaction_id, e.transaction_line_id FROM exceptions e
               JOIN external_identifiers x ON x.entity_id=e.transaction_id
               WHERE x.value='INV-2002' AND e.calculation_type='cost' AND e.status!='resolved' LIMIT 1"""
        ).fetchone()

    def tearDown(self):
        self.conn.close()

    def test_missing_cost_created_an_exception(self):
        self.assertIsNotNone(self.exc)

    def test_resolution_recalculates_and_preserves_history(self):
        line_id = self.exc["transaction_line_id"]
        gp_before = len(snapshots.history(self.conn, "transaction_line", line_id, snapshots.CALC_GROSS_PROFIT))
        pop_before = compute_separated_totals(self.conn, DEFAULT_POLICY).populations
        res = resolution.supply_cost_evidence(
            self.conn, self.exc["id"], product_cost="90.00", policy=DEFAULT_POLICY,
            matrix=EvidenceMatrix(), vendor_bill_number="VB-2002")
        # exception resolved (cost + gross_profit both)
        self.assertGreaterEqual(len(res["resolved_exceptions"]), 1)
        row = self.conn.execute("SELECT status FROM exceptions WHERE id=?", (self.exc["id"],)).fetchone()
        self.assertEqual(row["status"], "resolved")
        # new snapshots appended, prior preserved
        gp_after = len(snapshots.history(self.conn, "transaction_line", line_id, snapshots.CALC_GROSS_PROFIT))
        self.assertGreater(gp_after, gp_before)
        # profitability-eligible revenue increased (excluded revenue moved in)
        pop_after = compute_separated_totals(self.conn, DEFAULT_POLICY).populations
        self.assertGreater(pop_after.prof_net_revenue.minor, pop_before.prof_net_revenue.minor)
        self.assertLess(pop_after.excluded_net_revenue.minor, pop_before.excluded_net_revenue.minor)
        # audit history retained
        kinds = [e["kind"] for e in recent(self.conn, 200)]
        self.assertIn("evidence_resolved_cost", kinds)

    def test_cost_now_not_unverified(self):
        resolution.supply_cost_evidence(
            self.conn, self.exc["id"], product_cost="90.00", policy=DEFAULT_POLICY,
            matrix=EvidenceMatrix())
        lvl = self.conn.execute(
            "SELECT level FROM record_verifications WHERE transaction_id=? AND calculation_type='cost'",
            (self.exc["transaction_id"],)).fetchone()["level"]
        self.assertNotEqual(lvl, "unverified")


if __name__ == "__main__":
    unittest.main()
