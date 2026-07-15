"""Calculation-level (not record-wide) verification via the evidence matrix."""

import unittest

from finance_system.evidence import EvidenceMatrix
from finance_system.verification import CalculationType, VerificationLevel


class TestVerification(unittest.TestCase):
    def setUp(self):
        self.matrix = EvidenceMatrix()

    def _record(self, **over):
        # A fully-evidenced record: every required AND recommended field present,
        # so each calculation classifies VERIFIED unless a test removes a field.
        base = {
            "transaction_type": "invoice", "customer_id": "cust_x",
            "external_invoice_number": "INV-1", "transaction_date": "2026-06-05",
            "quantity": "2", "unit_sales_price": "100.00",
            "discount": "0.00", "customer_shipping": "0.00", "tax": "0.00",
            "product_cost": "120.00", "freight_in": "0.00", "freight_out": "0.00",
            "vendor_id": "vend_x", "vendor_bill_number": "VB-1",
            "commission_rule_id": "CR1", "commission_basis": "gross_profit",
            "commission_rate": "0.10", "commission_eligibility": "on_invoice",
            "period_assignment_date": "2026-06-05",
            "invoice_date": "2026-06-05", "ship_date": "2026-06-04",
        }
        base.update(over)
        return base

    def test_fully_verified_record(self):
        rv = self.matrix.classify_record(self._record(), "invoice")
        for calc in CalculationType:
            self.assertTrue(rv.is_verified_for(calc), calc)

    def test_cost_missing_splits_verification(self):
        rec = self._record()
        del rec["product_cost"]
        rv = self.matrix.classify_record(rec, "invoice")
        # Revenue verified, but cost and gross-profit are NOT — a per-calc split.
        self.assertTrue(rv.is_verified_for(CalculationType.REVENUE))
        self.assertEqual(rv.level_for(CalculationType.COST), VerificationLevel.UNVERIFIED)
        self.assertEqual(rv.level_for(CalculationType.GROSS_PROFIT), VerificationLevel.UNVERIFIED)
        self.assertIn("product_cost", rv.by_calc[CalculationType.COST].missing_fields)

    def test_commission_basis_never_assumed(self):
        rec = self._record()
        for k in ("commission_rule_id", "commission_basis", "commission_rate"):
            del rec[k]
        rv = self.matrix.classify_record(rec, "invoice")
        self.assertEqual(rv.level_for(CalculationType.COMMISSION), VerificationLevel.UNVERIFIED)
        # revenue/profit remain verified independently
        self.assertTrue(rv.is_verified_for(CalculationType.GROSS_PROFIT))

    def test_provisional_when_recommended_missing(self):
        rec = self._record()
        del rec["discount"]  # a REVENUE recommended field; required ones still present
        rv = self.matrix.classify_record(rec, "invoice")
        self.assertEqual(rv.level_for(CalculationType.REVENUE), VerificationLevel.PROVISIONAL)
        self.assertIn("discount", rv.by_calc[CalculationType.REVENUE].missing_fields)


if __name__ == "__main__":
    unittest.main()
