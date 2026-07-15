"""Reconciliation engine + full A–K report integrity."""

import unittest
from decimal import Decimal

from finance_system import batch_report, reconcile
from finance_system.policies import DEFAULT_POLICY
from finance_system.scope import ReportScope
from tests.helpers import fresh_db, import_fixture


class TestReconcileReport(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch_id, self.period_id = import_fixture(self.conn, post=True)
        from finance_system import pipeline
        pipeline.run_reconciliation(self.conn, self.period_id, self.batch_id)
        self.scope = ReportScope.for_batch(self.period_id, self.batch_id, DEFAULT_POLICY)

    def tearDown(self):
        self.conn.close()

    def test_reconciliation_rules_and_tolerances(self):
        recons = reconcile.reconcile_posted(self.conn, self.period_id)
        rules = {r.rule for r in recons}
        self.assertIn("freight_revenue_vs_cost", rules)
        self.assertIn("commission_vs_policy", rules)
        self.assertIn("duplicate_external_identifier", rules)  # INV-2001 twice
        # every recon carries explicit tolerance + status
        for r in recons:
            self.assertIn(r.status, ("within_tolerance", "exception"))
            self.assertIsNotNone(r.tolerance)

    def test_freight_under_recovery_flagged_negative(self):
        recons = reconcile.reconcile_posted(self.conn, self.period_id)
        fr = [r for r in recons if r.rule == "freight_revenue_vs_cost" and r.status == "exception"]
        self.assertTrue(fr)  # INV-2004 billed 10 vs freight-out 50

    def test_full_A_to_K_sections_present(self):
        rep = batch_report.build_report(self.conn, self.scope, DEFAULT_POLICY)
        for key in ("A_intake", "B_verified_transactions", "C_provisional_transactions",
                    "D_wheres_your_proof", "E_verified_totals", "F_provisional_excluded_totals",
                    "G_reconciliation", "H_analytical", "I_recommended_actions",
                    "J_database_update", "K_processing_status"):
            self.assertIn(key, rep)

    def test_buckets_reconcile(self):
        from finance_system.reporting import compute_separated_totals
        totals = compute_separated_totals(self.conn, DEFAULT_POLICY)
        bridge = totals.reconciliation_bridge()
        for metric in ("net_revenue", "total_cost", "gross_profit"):
            m = bridge[metric]
            s = sum(Decimal(m[k]) for k in ("verified", "provisional", "exception_excluded",
                                            "estimated", "forecast"))
            self.assertEqual(s, Decimal(m["grand_total"]))

    def test_verified_totals_exclude_unsupported_profitability(self):
        rep = batch_report.build_report(self.conn, self.scope, DEFAULT_POLICY)
        bridge = rep["F_provisional_excluded_totals"]["profitability_bridge"]
        # There is revenue verified but excluded from profitability (cost-missing line).
        self.assertNotEqual(Decimal(bridge["revenue_excluded_from_verified_profitability"]),
                            Decimal("0"))

    def test_negative_margin_and_zero_denominator_handled(self):
        rep = batch_report.build_report(self.conn, self.scope, DEFAULT_POLICY)
        self.assertGreaterEqual(rep["H_analytical"]["negative_margin_lines"], 1)
        # zero-revenue line did not crash the report; margin remains computable/None-safe
        self.assertIn("verified_gross_margin_pct", rep["E_verified_totals"])


if __name__ == "__main__":
    unittest.main()
