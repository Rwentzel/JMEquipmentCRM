"""Defect 2 regression: profitability-verified population integrity."""

import unittest
from decimal import Decimal

from finance_system.policies import DEFAULT_POLICY
from finance_system.reporting import compute_separated_totals
from tests.helpers import fresh_db, import_fixture


class TestProfitability(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch_id, self.period_id = import_fixture(self.conn, post=True)
        self.totals = compute_separated_totals(self.conn, DEFAULT_POLICY)
        self.pop = self.totals.populations

    def tearDown(self):
        self.conn.close()

    def test_cost_missing_line_revenue_is_verified(self):
        # INV-2002 has verified revenue but missing cost.
        self.assertGreater(self.pop.revenue_verified_net_revenue.minor, 0)
        # Its revenue is excluded from the profitability-eligible population.
        self.assertGreater(self.pop.excluded_net_revenue.minor, 0)

    def test_verified_margin_uses_only_profitability_population(self):
        # eligible net revenue < revenue-verified net revenue (something is excluded)
        self.assertLess(self.pop.prof_net_revenue.minor,
                        self.pop.revenue_verified_net_revenue.minor)
        # verified margin denominator == profitability-eligible net revenue, not all revenue
        m = self.pop.verified_gross_margin_pct()
        expected = (Decimal(self.pop.prof_gross_profit.minor) /
                    Decimal(self.pop.prof_net_revenue.minor) * 100).quantize(Decimal("0.000001"))
        self.assertEqual(m, expected)

    def test_excluded_revenue_not_in_margin_denominator(self):
        # If we (incorrectly) used revenue-verified revenue, margin would differ.
        wrong = (Decimal(self.pop.prof_gross_profit.minor) /
                 Decimal(self.pop.revenue_verified_net_revenue.minor) * 100)
        right = self.pop.verified_gross_margin_pct()
        self.assertNotEqual(right, wrong.quantize(Decimal("0.000001")))

    def test_bridge_reconciles(self):
        b = self.pop.bridge()
        total = Decimal(b["total_revenue_verified_net_revenue"])
        eligible = Decimal(b["net_revenue_eligible_for_verified_profitability"])
        excluded = Decimal(b["revenue_excluded_from_verified_profitability"])
        self.assertEqual(total, eligible + excluded)

    def test_exclusion_reason_recorded(self):
        self.assertTrue(self.pop.exclusions)
        self.assertIn("cost", self.pop.exclusions[0]["reason"])


if __name__ == "__main__":
    unittest.main()
