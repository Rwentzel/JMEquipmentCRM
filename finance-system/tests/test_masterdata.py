"""Master-data lookup: search, aliases, history, duplicate-master reporting."""

import unittest

from finance_system import masterdata as md
from finance_system.db import utcnow_iso
from finance_system.ids import new_id
from tests.helpers import fresh_db, import_fixture


class TestMasterData(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        import_fixture(self.conn, post=True)

    def tearDown(self):
        self.conn.close()

    def test_search_each_kind(self):
        self.assertTrue(md.search(self.conn, "customer", "Northwind"))
        self.assertTrue(md.search(self.conn, "product", "Bearing"))
        self.assertEqual(md.search(self.conn, "customer", "no-such-customer"), [])

    def test_customer_profile_has_transactions_and_price_history(self):
        cid = md.search(self.conn, "customer", "Northwind")[0]["id"]
        p = md.customer_profile(self.conn, cid)
        self.assertEqual(p["name"], "Northwind Test Co")
        self.assertGreater(p["transaction_count"], 0)
        self.assertTrue(p["price_history"])
        self.assertIn("unit_price", p["price_history"][0])

    def test_product_profile_price_range_and_cost_history(self):
        pid = md.search(self.conn, "product", "Bearing")[0]["id"]
        p = md.product_profile(self.conn, pid)
        self.assertIsNotNone(p["price_range"])
        self.assertTrue(p["cost_history"])

    def test_product_search_matches_alias(self):
        pid = md.search(self.conn, "product", "Bearing")[0]["id"]
        self.conn.execute(
            """INSERT INTO product_aliases(id, product_id, alias_type, alias_value)
               VALUES (?, ?, 'oem', 'ZZ-9000')""", (new_id("product_alias"), pid))
        hits = md.search(self.conn, "product", "ZZ-9000")
        self.assertEqual([h["id"] for h in hits], [pid])

    def test_duplicate_masters_reported_not_merged(self):
        # a second customer whose name differs only by case/punctuation
        self.conn.execute(
            """INSERT INTO customers(id, name, name_raw, created_at) VALUES (?, ?, ?, ?)""",
            (new_id("customer"), "northwind test co.", "northwind test co.", utcnow_iso()))
        dupes = md.potential_duplicate_masters(self.conn, "customer")
        self.assertTrue(dupes)
        self.assertGreaterEqual(dupes[0]["count"], 2)
        self.assertIn("do not merge", dupes[0]["recommended_disposition"])
        # nothing was merged away
        n = self.conn.execute("SELECT COUNT(*) FROM customers WHERE name LIKE '%orthwind%'").fetchone()[0]
        self.assertEqual(n, 2)

    def test_unknown_ids_raise(self):
        for fn in (md.customer_profile, md.vendor_profile, md.product_profile):
            with self.assertRaises(KeyError):
                fn(self.conn, "nope")


if __name__ == "__main__":
    unittest.main()
