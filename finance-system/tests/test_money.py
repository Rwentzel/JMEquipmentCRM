"""Exact decimal behaviour, negative values, ratio canonicalisation."""

import unittest
from decimal import Decimal

from finance_system.money import (
    Money, money_sum, quantity_from_stored, quantity_to_stored,
    ratio_from_canonical, ratio_to_canonical,
)


class TestMoney(unittest.TestCase):
    def test_exact_addition_no_float_error(self):
        self.assertEqual(Money.of("0.1") + Money.of("0.2"), Money.of("0.3"))
        self.assertEqual((Money.of("0.1") + Money.of("0.2")).minor, 3000)

    def test_scale4_storage(self):
        self.assertEqual(Money.of("100.005").minor, 1000050)
        self.assertEqual(Money.of("100.005").as_decimal(), Decimal("100.0050"))

    def test_half_up_rounding_into_scale(self):
        # 5th decimal rounds half-up into the 4th.
        self.assertEqual(Money.of("1.00005").minor, 10001)

    def test_negative_values(self):
        m = Money.of("-5.00")
        self.assertTrue(m.is_negative())
        self.assertEqual(m.minor, -50000)
        self.assertEqual((Money.of("3.00") - Money.of("5.00")).minor, -20000)

    def test_multiply_by_quantity(self):
        self.assertEqual(Money.of("100.00").multiply(Decimal("2")), Money.of("200.00"))
        self.assertEqual(Money.of("10.00").multiply("0.5"), Money.of("5.00"))

    def test_currency_mismatch_raises(self):
        with self.assertRaises(ValueError):
            Money.of("1", "USD") + Money.of("1", "EUR")

    def test_money_sum_empty_is_zero(self):
        self.assertEqual(money_sum([]), Money.zero())

    def test_quantity_roundtrip(self):
        stored = quantity_to_stored("2.5")
        self.assertEqual(stored, 25000)
        self.assertEqual(quantity_from_stored(stored), Decimal("2.5000"))

    def test_ratio_canonical_not_float(self):
        self.assertEqual(ratio_to_canonical("0.0500"), "0.05")
        self.assertEqual(ratio_from_canonical("0.05"), Decimal("0.05"))


if __name__ == "__main__":
    unittest.main()
