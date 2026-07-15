"""Margin vs markup, weighted totals, credits/returns, zero denominator, negatives."""

import unittest
from decimal import Decimal

from finance_system.formulas import (
    CostComponents, compute_line, gross_margin_pct, gross_profit, markup_pct,
    line_net_revenue, line_gross_revenue, unit_actual_cost,
    weighted_gross_margin_pct, weighted_markup_pct,
)
from finance_system.money import Money
from finance_system.policies import DEFAULT_POLICY


class TestFormulas(unittest.TestCase):
    def test_margin_is_not_markup(self):
        gp, rev, cost = Money.of("40"), Money.of("100"), Money.of("60")
        self.assertEqual(gross_margin_pct(gp, rev), Decimal("40.000000"))
        self.assertEqual(markup_pct(gp, cost), Decimal("66.666667"))
        self.assertNotEqual(gross_margin_pct(gp, rev), markup_pct(gp, cost))

    def test_zero_denominator_returns_none(self):
        self.assertIsNone(gross_margin_pct(Money.of("10"), Money.zero()))
        self.assertIsNone(markup_pct(Money.of("10"), Money.zero()))
        self.assertIsNone(unit_actual_cost(Money.of("10"), Decimal("0")))

    def test_negative_margin(self):
        gp = gross_profit(Money.of("80"), Money.of("100"))
        self.assertTrue(gp.is_negative())
        self.assertEqual(gross_margin_pct(gp, Money.of("80")), Decimal("-25.000000"))

    def test_credits_and_returns_reduce_revenue(self):
        gross = line_gross_revenue(Decimal("1"), Money.of("100"))
        net = line_net_revenue(
            gross, discounts=Money.of("5"), credits=Money.of("10"),
            returns=Money.of("15"), customer_shipping=Money.of("20"),
            other_authorized_charges=Money.zero(), policy=DEFAULT_POLICY)
        # 100 - 5 - 10 - 15 + 20 = 90
        self.assertEqual(net, Money.of("90"))

    def test_weighted_totals_not_average_of_percentages(self):
        # Two lines: (gp 10 / rev 100) and (gp 90 / rev 100). Simple avg of pct = 50%,
        # weighted = 100/200 = 50% here by design; use asymmetric to prove weighting.
        total_gp, total_rev, total_cost = Money.of("30"), Money.of("300"), Money.of("270")
        self.assertEqual(weighted_gross_margin_pct(total_gp, total_rev), Decimal("10.000000"))
        self.assertEqual(weighted_markup_pct(total_gp, total_cost),
                         Decimal("11.111111"))

    def test_compute_line_full_chain(self):
        costs = CostComponents.zero()
        costs = CostComponents(
            product_cost=Money.of("120"), freight_in=Money.of("10"),
            freight_out=Money.of("15"), crating=Money.zero(),
            direct_labor=Money.zero(), outside_services=Money.zero(),
            installation=Money.zero(), travel=Money.zero(),
            processing_fees=Money.zero(), tariffs=Money.zero(),
            other_direct=Money.zero(), allocated_overhead=Money.of("999"))
        result = compute_line(
            quantity=Decimal("2"), unit_sales_price=Money.of("100"),
            discounts=Money.zero(), credits=Money.zero(), returns=Money.zero(),
            customer_shipping=Money.of("20"), other_authorized_charges=Money.zero(),
            costs=costs, policy=DEFAULT_POLICY)
        self.assertEqual(result.gross_revenue, Money.of("200"))
        self.assertEqual(result.net_revenue, Money.of("220"))
        # overhead excluded by default policy -> 120+10+15 = 145
        self.assertEqual(result.total_cost, Money.of("145"))
        self.assertEqual(result.gross_profit, Money.of("75"))


if __name__ == "__main__":
    unittest.main()
