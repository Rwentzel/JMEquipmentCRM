"""End-to-end sanitized smoke: classifications and separated, reconciling totals."""

import unittest
from decimal import Decimal

from finance_system.smoke import run_smoke


class TestSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_smoke(":memory:")

    def _by_key(self, key):
        return next(c for c in self.result["classifications"] if c["key"] == key)

    def test_all_records_classified(self):
        self.assertEqual(self.result["records"], 8)
        self.assertEqual(len(self.result["classifications"]), 8)

    def test_revenue_verified_but_cost_missing(self):
        c = self._by_key("S2-cost-missing")
        self.assertEqual(c["by_calc"]["revenue"], "verified")
        self.assertEqual(c["by_calc"]["cost"], "unverified")
        self.assertEqual(c["by_calc"]["gross_profit"], "unverified")

    def test_commission_missing_flagged(self):
        c = self._by_key("S3-commission-missing")
        self.assertEqual(c["by_calc"]["commission"], "unverified")
        self.assertEqual(c["by_calc"]["revenue"], "verified")

    def test_duplicate_candidate_flagged_not_merged(self):
        dups = [f for f in self.result["reconciliation_findings"] if f["type"] == "duplicate"]
        self.assertTrue(dups)
        self.assertIn("INV-1001", dups[0]["detail"])

    def test_freight_under_recovery_flagged(self):
        fr = [f for f in self.result["reconciliation_findings"]
              if f["type"] == "freight_under_recovery"]
        self.assertTrue(fr)

    def test_open_exceptions_exist(self):
        self.assertTrue(self.result["open_exceptions"])

    def test_totals_are_separated_and_reconcile(self):
        totals = self.result["separated_totals"]
        bridge = totals["reconciliation_bridge"]["net_revenue"]
        buckets = ["verified", "provisional", "exception_excluded", "estimated", "forecast"]
        summed = sum(Decimal(bridge[b]) for b in buckets)
        self.assertEqual(summed, Decimal(bridge["grand_total"]))
        # Verified revenue must be strictly positive for this fixture.
        self.assertGreater(Decimal(bridge["verified"]), Decimal("0"))
        # The cost-missing line's revenue is verified, but its gross profit is excluded.
        gp = totals["reconciliation_bridge"]["gross_profit"]
        self.assertNotEqual(Decimal(gp["exception_excluded"]), Decimal("0"))


if __name__ == "__main__":
    unittest.main()
