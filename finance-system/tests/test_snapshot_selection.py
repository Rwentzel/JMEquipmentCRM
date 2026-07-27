"""Exchange 2.1: centralized current-snapshot selection + as-of reproduction."""

import unittest

from finance_system import resolution, snapshots
from finance_system.db import utcnow_iso
from finance_system.evidence import EvidenceMatrix
from finance_system.policies import DEFAULT_POLICY
from tests.helpers import fresh_db, import_fixture


class TestSnapshotSelection(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.batch, self.pid = import_fixture(self.conn, post=True)

    def tearDown(self):
        self.conn.close()

    def test_one_current_snapshot_per_context(self):
        snapshots.assert_single_current(self.conn)  # invariant holds after posting
        # exactly one current gross_profit snapshot per line
        rows = snapshots.current_snapshots(self.conn, calculation_name=snapshots.CALC_GROSS_PROFIT)
        line_ids = [r["source_line_id"] for r in rows]
        self.assertEqual(len(line_ids), len(set(line_ids)))

    def test_as_of_reproduces_prior_and_current_uses_replacement(self):
        exc = self.conn.execute(
            """SELECT e.id, e.transaction_line_id FROM exceptions e
               JOIN external_identifiers x ON x.entity_id=e.transaction_id
               WHERE x.value='INV-2002' AND e.calculation_type='cost' LIMIT 1""").fetchone()
        line_id = exc["transaction_line_id"]
        as_of = utcnow_iso()
        old = snapshots.current_snapshots(self.conn, as_of=as_of,
                                          calculation_name=snapshots.CALC_GROSS_PROFIT)
        old_val = next(s["output_value"] for s in old if s["source_line_id"] == line_id)
        resolution.supply_cost_evidence(self.conn, exc["id"], product_cost="90.00",
                                        policy=DEFAULT_POLICY, matrix=EvidenceMatrix())
        # after resolution, invariant still holds (still one current per context)
        snapshots.assert_single_current(self.conn)
        new = snapshots.current_snapshots(self.conn, calculation_name=snapshots.CALC_GROSS_PROFIT)
        new_val = next(s["output_value"] for s in new if s["source_line_id"] == line_id)
        as_of_again = snapshots.current_snapshots(self.conn, as_of=as_of,
                                                  calculation_name=snapshots.CALC_GROSS_PROFIT)
        old_again = next(s["output_value"] for s in as_of_again if s["source_line_id"] == line_id)
        self.assertNotEqual(old_val, new_val)      # replacement differs
        self.assertEqual(old_val, old_again)       # as-of reproduces the prior value

    def test_superseded_remains_available(self):
        exc = self.conn.execute(
            """SELECT e.id, e.transaction_line_id FROM exceptions e
               JOIN external_identifiers x ON x.entity_id=e.transaction_id
               WHERE x.value='INV-2002' AND e.calculation_type='cost' LIMIT 1""").fetchone()
        line_id = exc["transaction_line_id"]
        resolution.supply_cost_evidence(self.conn, exc["id"], product_cost="90.00",
                                        policy=DEFAULT_POLICY, matrix=EvidenceMatrix())
        hist = snapshots.history(self.conn, "transaction_line", line_id, snapshots.CALC_GROSS_PROFIT)
        self.assertGreaterEqual(len(hist), 2)  # both old and new retained


if __name__ == "__main__":
    unittest.main()
