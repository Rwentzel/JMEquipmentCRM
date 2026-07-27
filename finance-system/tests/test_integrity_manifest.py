"""Exchange 2.1: report manifest + integrity assertions."""

import unittest
from dataclasses import replace

from finance_system import batch_report
from finance_system.policies import DEFAULT_POLICY
from finance_system.reporting import ProfitabilityPopulations
from finance_system.scope import ReportScope
from tests.helpers import fresh_db, import_fixture


class TestIntegrityManifest(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch, self.pid = import_fixture(self.conn, post=True)
        self.scope = ReportScope.for_batch(self.pid, self.batch, DEFAULT_POLICY)
        self.rep = batch_report.build_report(self.conn, self.scope, DEFAULT_POLICY)

    def tearDown(self):
        self.conn.close()

    def test_report_has_manifest_and_integrity(self):
        self.assertIn("manifest", self.rep)
        self.assertIn("integrity", self.rep)
        m = self.rep["manifest"]
        for key in ("report_id", "generated_at", "schema_version", "scope", "calculation_policy",
                    "evidence_matrix_version", "formula_version", "currency", "integrity_ok"):
            self.assertIn(key, m)

    def test_integrity_ok_on_clean_data(self):
        self.assertTrue(self.rep["valid"])
        self.assertTrue(self.rep["integrity"]["ok"])
        self.assertTrue(all(c["passed"] for c in self.rep["integrity"]["checks"]))

    def test_integrity_detects_broken_cost_bridge(self):
        pop = ProfitabilityPopulations()
        broken_cost = {"policy_recognized_total_actual_cost": "100.00",
                       "reported_total_actual_cost": "999.00"}
        commission = {"superseded_rows_excluded": 0}
        result = batch_report.run_integrity_checks(
            pop, broken_cost, commission, {}, 0, self.conn, self.scope)
        self.assertFalse(result["ok"])
        failed = [c for c in result["checks"] if not c["passed"]]
        self.assertTrue(any("cost_bridge" in c["invariant"] for c in failed))

    def test_persist_manifest_writes_row(self):
        rid = batch_report.persist_manifest(self.conn, self.rep)
        row = self.conn.execute("SELECT integrity_ok FROM report_manifests WHERE id=?", (rid,)).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["integrity_ok"], 1)


if __name__ == "__main__":
    unittest.main()
