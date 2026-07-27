"""Reversible import pipeline: rollback, idempotency, period-lock refusal."""

import unittest

from finance_system.db import init_db, utcnow_iso
from finance_system import imports
from finance_system.ids import new_id
from finance_system.models import ImportBatchStatus


class TestImports(unittest.TestCase):
    def setUp(self):
        self.conn = init_db(":memory:")

    def tearDown(self):
        self.conn.close()

    def _stage_txn(self, batch_id, period_id=None):
        txn_id = new_id("transaction")
        self.conn.execute(
            """INSERT INTO transactions(id, transaction_type, import_batch_id,
               reporting_period_id, posted, created_at)
               VALUES (?, 'invoice', ?, ?, 0, ?)""",
            (txn_id, batch_id, period_id, utcnow_iso()))
        return txn_id

    def test_rollback_discards_staged_records(self):
        batch = imports.create_batch(self.conn, "b1")
        self._stage_txn(batch)
        self._stage_txn(batch)
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0], 2)
        imports.rollback_batch(self.conn, batch)
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0], 0)
        self.assertEqual(imports.batch_status(self.conn, batch),
                         ImportBatchStatus.ROLLED_BACK.value)

    def test_idempotent_reimport_detects_duplicate(self):
        content = b"invoice,amount\nINV-1,100\n"
        b1 = imports.create_batch(self.conn, "first")
        _, dup1 = imports.register_file(self.conn, b1, "month.csv", content)
        self.assertFalse(dup1)  # nothing posted yet
        self._stage_txn(b1)
        imports.post_batch(self.conn, b1)
        # Re-registering identical content in a new batch is flagged as duplicate.
        b2 = imports.create_batch(self.conn, "second")
        _, dup2 = imports.register_file(self.conn, b2, "month.csv", content)
        self.assertTrue(dup2)

    def test_cannot_post_into_locked_period(self):
        period_id = new_id("reporting_period")
        self.conn.execute(
            """INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
               VALUES (?, '2026-05', '2026-05-01', '2026-05-31', 1, ?)""",
            (period_id, utcnow_iso()))
        batch = imports.create_batch(self.conn, "locked")
        self._stage_txn(batch, period_id)
        with self.assertRaises(ValueError):
            imports.post_batch(self.conn, batch)
        # Nothing was posted.
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) FROM transactions WHERE posted=1").fetchone()[0], 0)

    def test_post_is_idempotent(self):
        batch = imports.create_batch(self.conn, "b")
        self._stage_txn(batch)
        self.assertEqual(imports.post_batch(self.conn, batch), 1)
        self.assertEqual(imports.post_batch(self.conn, batch), 0)  # already posted


if __name__ == "__main__":
    unittest.main()
