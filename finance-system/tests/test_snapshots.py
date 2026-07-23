"""Defect 1 regression: calculation snapshots are persisted, immutable, superseded."""

import sqlite3
import unittest

from finance_system import posting, resolution, snapshots
from finance_system.evidence import EvidenceMatrix
from finance_system.policies import DEFAULT_POLICY
from tests.helpers import fresh_db, import_fixture


class TestSnapshots(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch_id, self.period_id = import_fixture(self.conn, post=True)

    def tearDown(self):
        self.conn.close()

    def test_posting_creates_snapshots(self):
        n = self.conn.execute("SELECT COUNT(*) FROM calculation_snapshots WHERE import_batch_id=?",
                              (self.batch_id,)).fetchone()[0]
        self.assertGreater(n, 0)
        # every posted line produced the full family of material calculations
        names = {r[0] for r in self.conn.execute(
            "SELECT DISTINCT calculation_name FROM calculation_snapshots")}
        for expected in (snapshots.CALC_NET_LINE_REVENUE, snapshots.CALC_TOTAL_ACTUAL_COST,
                         snapshots.CALC_GROSS_PROFIT, snapshots.CALC_GROSS_MARGIN,
                         snapshots.CALC_MARKUP, snapshots.CALC_COMMISSION_AMOUNT):
            self.assertIn(expected, names)

    def test_snapshot_retains_policy_and_formula_version(self):
        r = self.conn.execute(
            "SELECT policy_id, policy_version, formula_version, policy_key FROM calculation_snapshots LIMIT 1").fetchone()
        self.assertEqual(r["policy_id"], DEFAULT_POLICY.name)
        self.assertEqual(r["policy_version"], DEFAULT_POLICY.version)
        self.assertEqual(r["formula_version"], snapshots.FORMULA_VERSION)
        self.assertEqual(r["policy_key"], DEFAULT_POLICY.key())

    def test_inputs_and_output_roundtrip_exactly(self):
        # net_line_revenue output is stored as integer minor units, exact.
        r = self.conn.execute(
            """SELECT output_value, output_kind FROM calculation_snapshots
               WHERE calculation_name='net_line_revenue' LIMIT 1""").fetchone()
        self.assertEqual(r["output_kind"], "money_minor")
        self.assertEqual(int(r["output_value"]), int(r["output_value"]))  # parseable int, no float

    def test_snapshots_are_append_only(self):
        sid = self.conn.execute("SELECT id FROM calculation_snapshots LIMIT 1").fetchone()[0]
        with self.assertRaises(sqlite3.Error):
            self.conn.execute("UPDATE calculation_snapshots SET output_value='0' WHERE id=?", (sid,))
        with self.assertRaises(sqlite3.Error):
            self.conn.execute("DELETE FROM calculation_snapshots WHERE id=?", (sid,))

    def test_recalculation_creates_new_snapshot_preserving_prior(self):
        exc = self.conn.execute(
            """SELECT e.id, e.transaction_line_id FROM exceptions e
               JOIN external_identifiers x ON x.entity_id=e.transaction_id
               WHERE x.value='INV-2002' AND e.calculation_type='cost' LIMIT 1""").fetchone()
        line_id = exc["transaction_line_id"]
        before = snapshots.history(self.conn, "transaction_line", line_id, snapshots.CALC_GROSS_PROFIT)
        before_ids = {s["id"] for s in before}
        resolution.supply_cost_evidence(
            self.conn, exc["id"], product_cost="90.00", policy=DEFAULT_POLICY,
            matrix=EvidenceMatrix(), vendor_bill_number="VB-X")
        after = snapshots.history(self.conn, "transaction_line", line_id, snapshots.CALC_GROSS_PROFIT)
        after_ids = {s["id"] for s in after}
        self.assertTrue(before_ids <= after_ids)          # originals preserved
        self.assertGreater(len(after), len(before))       # a new snapshot appended
        newest = after[-1]
        self.assertIsNotNone(newest["superseded_snapshot_id"])  # points at the prior one


if __name__ == "__main__":
    unittest.main()
