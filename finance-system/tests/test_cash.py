"""Cash application: balances, partial/over payment, unapplied cash, credits, reversal."""

import unittest

from finance_system import cash
from finance_system.db import utcnow_iso
from finance_system.ids import new_id
from finance_system.money import Money
from finance_system.policies import DEFAULT_POLICY
from finance_system.scope import ReportScope
from tests.helpers import fresh_db, make_period


def _doc(conn, kind, amount, period_id, ref=None):
    tid = new_id("transaction")
    conn.execute(
        """INSERT INTO transactions(id, transaction_type, reporting_period_id, posted,
           currency, created_at) VALUES (?, ?, ?, 1, 'USD', ?)""",
        (tid, kind, period_id, utcnow_iso()))
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


class TestCash(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.pid = make_period(self.conn)
        self.invoice = _doc(self.conn, "invoice", "1000.00", self.pid, ref="INV-1")
        self.payment = _doc(self.conn, "payment", "1000.00", self.pid)

    def tearDown(self):
        self.conn.close()

    def test_open_invoice_balance(self):
        self.assertEqual(cash.invoice_total(self.conn, self.invoice), Money.of("1000.00"))
        self.assertEqual(cash.invoice_balance(self.conn, self.invoice), Money.of("1000.00"))
        self.assertEqual(cash.ar_status(self.conn, self.invoice).status, "open")

    def test_partial_payment(self):
        cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice,
                           amount="400.00")
        st = cash.ar_status(self.conn, self.invoice)
        self.assertEqual(st.status, "partially_paid")
        self.assertEqual(st.balance, Money.of("600.00"))

    def test_multiple_payments_settle_invoice(self):
        cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice, amount="400.00")
        cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice, amount="600.00")
        st = cash.ar_status(self.conn, self.invoice)
        self.assertEqual(st.status, "paid")
        self.assertEqual(st.balance, Money.zero())

    def test_overpayment_refused_unless_authorized(self):
        with self.assertRaises(cash.CashApplicationError):
            cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice,
                               amount="1500.00")
        # authorized overpayment is allowed and visible
        cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice,
                           amount="1500.00", allow_overpayment=True)
        self.assertEqual(cash.ar_status(self.conn, self.invoice).status, "overpaid")

    def test_unapplied_cash_tracked(self):
        cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice, amount="250.00")
        self.assertEqual(cash.unapplied_cash(self.conn, self.payment), Money.of("750.00"))
        cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=None, amount="750.00",
                           note="deposit on account")
        # applying to no invoice does not reduce the invoice balance
        self.assertEqual(cash.invoice_balance(self.conn, self.invoice), Money.of("750.00"))

    def test_credit_application(self):
        credit = _doc(self.conn, "credit_memo", "100.00", self.pid)
        cash.apply_payment(self.conn, payment_id=credit, invoice_id=self.invoice,
                           amount="100.00", kind=cash.KIND_CREDIT)
        self.assertEqual(cash.invoice_balance(self.conn, self.invoice), Money.of("900.00"))

    def test_reversal_restores_balance_and_is_append_only(self):
        app = cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice,
                                 amount="400.00")
        cash.reverse_application(self.conn, app)
        self.assertEqual(cash.invoice_balance(self.conn, self.invoice), Money.of("1000.00"))
        # the original row still exists (append-only, not deleted)
        rows = self.conn.execute(
            "SELECT COUNT(*) FROM payment_applications WHERE invoice_transaction_id=?",
            (self.invoice,)).fetchone()[0]
        self.assertEqual(rows, 2)
        with self.assertRaises(cash.CashApplicationError):
            cash.reverse_application(self.conn, app)      # no double reversal

    def test_cash_bridge_separates_invoiced_from_collected(self):
        cash.apply_payment(self.conn, payment_id=self.payment, invoice_id=self.invoice, amount="400.00")
        bridge = cash.cash_bridge(self.conn, ReportScope.for_period(self.pid, DEFAULT_POLICY))
        self.assertEqual(bridge["invoiced_revenue"], "1000.00")
        self.assertEqual(bridge["collected_cash_applied"], "400.00")
        self.assertEqual(bridge["outstanding_receivable"], "600.00")
        self.assertEqual(bridge["unapplied_cash_deposits"], "600.00")
        self.assertEqual(bridge["invoice_status_counts"]["partially_paid"], 1)


if __name__ == "__main__":
    unittest.main()
