"""Configurable vendor-cost evidence + crating revenue/recovery."""

import unittest

from finance_system import cost_evidence as ce, snapshots
from finance_system.policies import DEFAULT_POLICY
from finance_system.money import Money
from tests.helpers import fresh_db, import_content, make_period, seed_rules

CRATING_CSV = (
    b"Type,Customer,Item,Invoice #,Date,Period Date,Qty,Unit Price,Cost,Crating Billed,Crating\n"
    # crating revenue AND cost -> recovery is a real, verifiable figure
    b"Invoice,Crate Test Co,Part A,INV-4001,2026-06-03,2026-06-03,1,500.00,300.00,80.00,50.00\n"
    # crating cost but NO crating revenue -> recovery cannot be verified
    b"Invoice,Crate Test Co,Part B,INV-4002,2026-06-04,2026-06-04,1,500.00,300.00,0,60.00\n"
)


class TestVendorEvidencePolicy(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        self.key = DEFAULT_POLICY.key()
        ce.install_default_policy(self.conn, self.key)
        self.line = "line_test"
        self.conn.execute(
            """INSERT INTO transactions(id, transaction_type, posted, currency, created_at)
               VALUES ('txn_test','invoice',1,'USD','t')""")
        self.conn.execute(
            """INSERT INTO transaction_lines(id, transaction_id, line_number, currency, created_at)
               VALUES (?, 'txn_test', 1, 'USD', 't')""", (self.line,))

    def tearDown(self):
        self.conn.close()

    def test_no_evidence_is_unverified(self):
        self.assertEqual(ce.evaluate_line(self.conn, self.line, self.key).level, "unverified")

    def test_vendor_bill_verifies(self):
        ce.record_evidence(self.conn, evidence_type=ce.VENDOR_BILL,
                           transaction_line_id=self.line, amount="120.00", source_reference="VB-9")
        v = ce.evaluate_line(self.conn, self.line, self.key)
        self.assertEqual(v.level, "verified")
        self.assertEqual(v.evidence_type, ce.VENDOR_BILL)

    def test_alternative_evidence_satisfies_without_a_vendor_bill(self):
        """A PO alone is provisional, not rejected — a vendor bill is not universally required."""
        ce.record_evidence(self.conn, evidence_type=ce.PURCHASE_ORDER,
                           transaction_line_id=self.line, amount="120.00")
        self.assertEqual(ce.evaluate_line(self.conn, self.line, self.key).level, "provisional")

    def test_strongest_evidence_wins(self):
        ce.record_evidence(self.conn, evidence_type=ce.VENDOR_QUOTE, transaction_line_id=self.line)
        ce.record_evidence(self.conn, evidence_type=ce.FREIGHT_INVOICE, transaction_line_id=self.line)
        self.assertEqual(ce.evaluate_line(self.conn, self.line, self.key).level, "verified")

    def test_expired_evidence_is_ignored(self):
        ce.record_evidence(self.conn, evidence_type=ce.VENDOR_BILL,
                           transaction_line_id=self.line, expires_on="2020-01-01")
        self.assertEqual(ce.evaluate_line(self.conn, self.line, self.key).level, "unverified")

    def test_acceptance_is_configurable(self):
        ce.record_evidence(self.conn, evidence_type=ce.MANUFACTURER_PRICE_LIST,
                           transaction_line_id=self.line)
        self.assertEqual(ce.evaluate_line(self.conn, self.line, self.key).level, "provisional")
        ce.set_acceptance(self.conn, self.key, ce.MANUFACTURER_PRICE_LIST, "verified")
        self.assertEqual(ce.evaluate_line(self.conn, self.line, self.key).level, "verified")

    def test_unknown_type_rejected(self):
        with self.assertRaises(ValueError):
            ce.record_evidence(self.conn, evidence_type="napkin_note",
                               transaction_line_id=self.line)


class TestCratingRecovery(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        rules = seed_rules(self.conn)
        self.pid = make_period(self.conn)
        self.batch = import_content(self.conn, CRATING_CSV, period_id=self.pid, rules=rules,
                                    filename="crate.csv")

    def tearDown(self):
        self.conn.close()

    def _recovery(self, invoice_ref):
        row = self.conn.execute(
            """SELECT cs.output_value, cs.verification_level FROM calculation_snapshots cs
               JOIN external_identifiers e ON e.entity_id = cs.source_transaction_id
               WHERE cs.calculation_name=? AND e.value=?""",
            (snapshots.CALC_CRATING_RECOVERY, invoice_ref)).fetchone()
        return Money.from_minor(int(row["output_value"])), row["verification_level"]

    def test_recovery_is_revenue_minus_cost(self):
        amount, _ = self._recovery("INV-4001")
        self.assertEqual(amount, Money.of("30.00"))     # 80 billed - 50 cost

    def test_missing_crating_revenue_is_not_verified(self):
        """Cost known, customer crating revenue unknown -> recovery stays unverified."""
        amount, level = self._recovery("INV-4002")
        self.assertEqual(amount, Money.of("-60.00"))
        self.assertEqual(level, "unverified")

    def test_crating_revenue_counts_as_customer_charge(self):
        row = self.conn.execute(
            """SELECT cs.output_value FROM calculation_snapshots cs
               JOIN external_identifiers e ON e.entity_id = cs.source_transaction_id
               WHERE cs.calculation_name=? AND e.value='INV-4001'""",
            (snapshots.CALC_NET_LINE_REVENUE,)).fetchone()
        # 500 sale + 80 crating billed = 580 net revenue
        self.assertEqual(Money.from_minor(int(row["output_value"])), Money.of("580.00"))


if __name__ == "__main__":
    unittest.main()
