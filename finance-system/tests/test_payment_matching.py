"""Payment matching proposes explainable matches; it never applies money on its own."""

import unittest

from finance_system import cash, payment_matching as pm
from finance_system.db import utcnow_iso
from finance_system.ids import new_id
from finance_system.money import Money
from finance_system.policies import DEFAULT_POLICY
from finance_system.scope import ReportScope
from tests.helpers import fresh_db, make_period


def _doc(conn, kind, amount, pid, customer_id=None, ref=None, on_date="2026-06-05"):
    tid = new_id("transaction")
    conn.execute(
        """INSERT INTO transactions(id, transaction_type, customer_id, reporting_period_id,
           posted, currency, invoice_date, payment_date, transaction_date, created_at)
           VALUES (?, ?, ?, ?, 1, 'USD', ?, ?, ?, ?)""",
        (tid, kind, customer_id, pid, on_date, on_date, on_date, utcnow_iso()))
    conn.execute(
        """INSERT INTO transaction_lines(id, transaction_id, line_number, quantity_minor,
           unit_sales_price_minor, currency, created_at) VALUES (?, ?, 1, ?, ?, 'USD', ?)""",
        (new_id("transaction_line"), tid, 10000, Money.of(amount).minor, utcnow_iso()))
    if ref:
        conn.execute(
            """INSERT INTO external_identifiers(id, entity_kind, entity_id, namespace, value, created_at)
               VALUES (?, 'transaction', ?, 'invoice_number', ?, ?)""",
            (new_id("external_identifier"), tid, ref, utcnow_iso()))
    return tid


class TestPaymentMatching(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.pid = make_period(self.conn)
        self.cust = new_id("customer")
        self.conn.execute("INSERT INTO customers(id,name,name_raw,created_at) VALUES (?,?,?,?)",
                          (self.cust, "Match Test Co", "Match Test Co", utcnow_iso()))
        self.other = new_id("customer")
        self.conn.execute("INSERT INTO customers(id,name,name_raw,created_at) VALUES (?,?,?,?)",
                          (self.other, "Other Co", "Other Co", utcnow_iso()))
        self.scope = ReportScope.for_period(self.pid, DEFAULT_POLICY)

    def tearDown(self):
        self.conn.close()

    def test_exact_reference_and_amount_is_top_proposal(self):
        inv = _doc(self.conn, "invoice", "500.00", self.pid, self.cust, ref="INV-900")
        pay = _doc(self.conn, "payment", "500.00", self.pid, self.cust, ref="INV-900")
        props = pm.propose_matches(self.conn, self.scope)
        self.assertTrue(props)
        top = props[0]
        self.assertEqual((top.payment_id, top.invoice_id), (pay, inv))
        self.assertIn("payment references this invoice number", top.matching_signals)
        self.assertIn("amount exactly settles the invoice", top.matching_signals)
        self.assertEqual(top.recommended_disposition, "apply in full — exact match")

    def test_nothing_is_applied_automatically(self):
        _doc(self.conn, "invoice", "500.00", self.pid, self.cust, ref="INV-901")
        _doc(self.conn, "payment", "500.00", self.pid, self.cust, ref="INV-901")
        pm.propose_matches(self.conn, self.scope)
        applied = self.conn.execute("SELECT COUNT(*) FROM payment_applications").fetchone()[0]
        self.assertEqual(applied, 0)      # proposals only

    def test_different_customer_is_never_proposed(self):
        _doc(self.conn, "invoice", "500.00", self.pid, self.other, ref="INV-902")
        _doc(self.conn, "payment", "500.00", self.pid, self.cust, ref="INV-902")
        self.assertEqual(pm.propose_matches(self.conn, self.scope), [])

    def test_partial_payment_suggests_the_lesser_amount(self):
        _doc(self.conn, "invoice", "1000.00", self.pid, self.cust, ref="INV-903")
        _doc(self.conn, "payment", "400.00", self.pid, self.cust)
        props = pm.propose_matches(self.conn, self.scope)
        self.assertTrue(props)
        self.assertEqual(props[0].suggested_amount, "400.00")
        self.assertIn("review", props[0].recommended_disposition)

    def test_settled_invoice_is_not_proposed_again(self):
        inv = _doc(self.conn, "invoice", "500.00", self.pid, self.cust, ref="INV-904")
        pay = _doc(self.conn, "payment", "500.00", self.pid, self.cust, ref="INV-904")
        cash.apply_payment(self.conn, payment_id=pay, invoice_id=inv, amount="500.00")
        self.assertEqual(pm.propose_matches(self.conn, self.scope), [])

    def test_apply_requires_an_approver(self):
        _doc(self.conn, "invoice", "500.00", self.pid, self.cust, ref="INV-905")
        _doc(self.conn, "payment", "500.00", self.pid, self.cust, ref="INV-905")
        prop = pm.propose_matches(self.conn, self.scope)[0]
        with self.assertRaises(cash.CashApplicationError):
            pm.apply_proposal(self.conn, prop, approved_by="   ")
        pm.apply_proposal(self.conn, prop, approved_by="riley")
        self.assertEqual(cash.ar_status(self.conn, prop.invoice_id).status, "paid")

    def test_approval_is_recorded_on_the_application(self):
        _doc(self.conn, "invoice", "500.00", self.pid, self.cust, ref="INV-906")
        _doc(self.conn, "payment", "500.00", self.pid, self.cust, ref="INV-906")
        prop = pm.propose_matches(self.conn, self.scope)[0]
        pm.apply_proposal(self.conn, prop, approved_by="riley")
        note = self.conn.execute(
            "SELECT note FROM payment_applications ORDER BY created_at DESC LIMIT 1").fetchone()["note"]
        self.assertIn("riley", note)
        self.assertIn("approved match", note)


if __name__ == "__main__":
    unittest.main()
