"""Per-line resolution isolation + evidence-driven cost reclassification."""

import unittest

from finance_system import cost_evidence as ce, resolution, snapshots
from finance_system.evidence import EvidenceMatrix
from finance_system.policies import DEFAULT_POLICY
from tests.helpers import fresh_db, import_content, make_period, seed_rules

# One invoice, three lines; only line 2 is missing its cost.
CSV = (
    b"Type,Customer,Item,Invoice #,Date,Period Date,Qty,Unit Price,Cost\n"
    b"Invoice,Iso Test Co,Part A,INV-7100,2026-06-03,2026-06-03,1,100.00,60.00\n"
    b"Invoice,Iso Test Co,Part B,INV-7100,2026-06-03,2026-06-03,1,200.00,\n"
    b"Invoice,Iso Test Co,Part C,INV-7100,2026-06-03,2026-06-03,1,300.00,\n"
)


class TestLineIsolation(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        rules = seed_rules(self.conn)
        self.pid = make_period(self.conn)
        self.batch = import_content(self.conn, CSV, period_id=self.pid, rules=rules,
                                    filename="iso.csv")
        self.lines = {r["description"]: r["id"] for r in self.conn.execute(
            "SELECT id, description FROM transaction_lines ORDER BY line_number")}

    def tearDown(self):
        self.conn.close()

    def _cost_level(self, line_id):
        return self.conn.execute(
            """SELECT level FROM record_verifications
               WHERE transaction_line_id=? AND calculation_type='cost'""", (line_id,)).fetchone()["level"]

    def test_setup_has_two_unverified_cost_lines(self):
        self.assertNotEqual(self._cost_level(self.lines["Part A"]), "unverified")
        self.assertEqual(self._cost_level(self.lines["Part B"]), "unverified")
        self.assertEqual(self._cost_level(self.lines["Part C"]), "unverified")

    def test_resolving_one_line_does_not_verify_its_siblings(self):
        """The multi-line trap: resolving line B must NOT silently verify line C."""
        exc = self.conn.execute(
            """SELECT id FROM exceptions WHERE transaction_line_id=? AND calculation_type='cost'""",
            (self.lines["Part B"],)).fetchone()
        resolution.supply_cost_evidence(
            self.conn, exc["id"], product_cost="90.00", policy=DEFAULT_POLICY,
            matrix=EvidenceMatrix(), vendor_bill_number="VB-B")
        self.assertNotEqual(self._cost_level(self.lines["Part B"]), "unverified")
        self.assertEqual(self._cost_level(self.lines["Part C"]), "unverified")  # untouched

    def test_cost_component_lands_on_the_right_line_only(self):
        exc = self.conn.execute(
            """SELECT id FROM exceptions WHERE transaction_line_id=? AND calculation_type='cost'""",
            (self.lines["Part B"],)).fetchone()
        resolution.supply_cost_evidence(
            self.conn, exc["id"], product_cost="90.00", policy=DEFAULT_POLICY,
            matrix=EvidenceMatrix())
        got = self.conn.execute(
            """SELECT transaction_line_id FROM cost_components WHERE component_type='product_cost'""",
        ).fetchall()
        lines_with_cost = {r["transaction_line_id"] for r in got}
        self.assertIn(self.lines["Part B"], lines_with_cost)
        self.assertNotIn(self.lines["Part C"], lines_with_cost)


class TestEvidenceDrivenReclassification(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        rules = seed_rules(self.conn)
        self.pid = make_period(self.conn)
        import_content(self.conn, CSV, period_id=self.pid, rules=rules, filename="ev.csv")
        ce.install_default_policy(self.conn, DEFAULT_POLICY.key())
        self.line = self.conn.execute(
            "SELECT id FROM transaction_lines WHERE description='Part C'").fetchone()["id"]

    def tearDown(self):
        self.conn.close()

    def _cost_level(self):
        return self.conn.execute(
            """SELECT level FROM record_verifications
               WHERE transaction_line_id=? AND calculation_type='cost'""", (self.line,)).fetchone()["level"]

    def test_purchase_order_evidence_upgrades_cost_to_provisional(self):
        """An alternative to a vendor bill is accepted per policy — not rejected outright."""
        self.assertEqual(self._cost_level(), "unverified")
        res = resolution.apply_cost_evidence(
            self.conn, transaction_line_id=self.line, evidence_type=ce.PURCHASE_ORDER,
            policy=DEFAULT_POLICY, matrix=EvidenceMatrix(), amount="150.00",
            source_reference="PO-55")
        self.assertEqual(res["cost_level"], "provisional")
        self.assertEqual(self._cost_level(), "provisional")
        self.assertGreater(res["new_snapshots"], 0)

    def test_stronger_evidence_reaches_verified_and_supersedes_snapshots(self):
        before = len(snapshots.history(self.conn, "transaction_line", self.line,
                                       snapshots.CALC_TOTAL_ACTUAL_COST))
        resolution.apply_cost_evidence(
            self.conn, transaction_line_id=self.line, evidence_type=ce.VENDOR_BILL,
            policy=DEFAULT_POLICY, matrix=EvidenceMatrix(), amount="150.00",
            source_reference="VB-77")
        self.assertEqual(self._cost_level(), "verified")
        after = len(snapshots.history(self.conn, "transaction_line", self.line,
                                      snapshots.CALC_TOTAL_ACTUAL_COST))
        self.assertGreater(after, before)          # history preserved, new snapshot appended

    def test_evidence_transition_is_audited(self):
        from finance_system.audit import recent
        resolution.apply_cost_evidence(
            self.conn, transaction_line_id=self.line, evidence_type=ce.VENDOR_QUOTE,
            policy=DEFAULT_POLICY, matrix=EvidenceMatrix())
        self.assertIn("cost_evidence_applied", [e["kind"] for e in recent(self.conn, 100)])


if __name__ == "__main__":
    unittest.main()
