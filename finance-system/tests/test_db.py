"""Migrations, money DB round-trip (integer minor units), append-only enforcement."""

import sqlite3
import unittest
from decimal import Decimal

from finance_system.audit import record_event
from finance_system.db import init_db, migrate
from finance_system.money import Money


class TestDb(unittest.TestCase):
    def setUp(self):
        self.conn = init_db(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_migration_idempotent(self):
        # Re-running migrate applies nothing new.
        self.assertEqual(migrate(self.conn), [])
        tables = {r[0] for r in self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        for expected in ("transactions", "transaction_lines", "cost_components",
                         "exceptions", "audit_events", "calculation_snapshots",
                         "external_identifiers", "import_batches"):
            self.assertIn(expected, tables)

    def test_money_roundtrip_exact(self):
        cur = self.conn.execute(
            "INSERT INTO import_batches(id, status, created_at) VALUES ('b', 'registered', 't')")
        self.conn.execute(
            """INSERT INTO transactions(id, transaction_type, created_at)
               VALUES ('t1', 'invoice', 't')""")
        original = Money.of("100.005")  # scale-4 => minor 1000050
        self.conn.execute(
            """INSERT INTO transaction_lines(id, transaction_id, unit_sales_price_minor,
               currency, created_at) VALUES ('l1', 't1', ?, 'USD', 't')""",
            (original.minor,))
        row = self.conn.execute(
            "SELECT unit_sales_price_minor FROM transaction_lines WHERE id='l1'").fetchone()
        restored = Money.from_minor(row["unit_sales_price_minor"])
        self.assertEqual(restored, original)
        self.assertEqual(restored.as_decimal(), Decimal("100.0050"))
        self.assertIsInstance(row["unit_sales_price_minor"], int)

    def test_audit_is_append_only(self):
        eid = record_event(self.conn, "test_kind", "a summary")
        with self.assertRaises(sqlite3.Error):
            self.conn.execute("UPDATE audit_events SET summary='x' WHERE id=?", (eid,))
        with self.assertRaises(sqlite3.Error):
            self.conn.execute("DELETE FROM audit_events WHERE id=?", (eid,))

    def test_snapshot_is_append_only(self):
        self.conn.execute(
            """INSERT INTO calculation_snapshots(id, calculation_type, policy_key,
               formula_version, inputs_json, output_value, output_kind, verification_level,
               created_at) VALUES ('c1','revenue','jm-default@v1','1','{}','0','money_minor',
               'verified','t')""")
        with self.assertRaises(sqlite3.Error):
            self.conn.execute("DELETE FROM calculation_snapshots WHERE id='c1'")

    def test_foreign_keys_enforced(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                """INSERT INTO transaction_lines(id, transaction_id, created_at)
                   VALUES ('l', 'no-such-txn', 't')""")


if __name__ == "__main__":
    unittest.main()
