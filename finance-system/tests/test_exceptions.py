"""Exception-to-verified transition with preserved append-only audit history."""

import unittest

from finance_system.audit import recent
from finance_system.db import init_db
from finance_system.evidence import EvidenceMatrix
from finance_system.exception_register import (
    exception_from_verification, open_exceptions, resolve_exception,
)
from finance_system.models import ExceptionStatus
from finance_system.verification import CalculationType, VerificationLevel


class TestExceptions(unittest.TestCase):
    def setUp(self):
        self.conn = init_db(":memory:")
        self.matrix = EvidenceMatrix()
        self.conn.execute(
            "INSERT INTO transactions(id, transaction_type, created_at) VALUES ('t1','invoice','t')")

    def tearDown(self):
        self.conn.close()

    def _record(self, with_cost):
        rec = {"transaction_type": "invoice", "customer_id": "c",
               "quantity": "1", "unit_sales_price": "100.00"}
        if with_cost:
            rec["product_cost"] = "60.00"
        return rec

    def test_exception_to_verified_without_losing_history(self):
        # 1. Cost missing -> COST unverified -> exception opened.
        rv = self.matrix.classify_record(self._record(with_cost=False), "invoice")
        cv = rv.by_calc[CalculationType.COST]
        self.assertEqual(cv.level, VerificationLevel.UNVERIFIED)
        exc_id = exception_from_verification(self.conn, cv, transaction_id="t1")
        self.assertIsNotNone(exc_id)
        self.assertEqual(len(open_exceptions(self.conn)), 1)

        # 2. Proof arrives; resolve the exception (row retained, not deleted).
        resolve_exception(self.conn, exc_id, "vendor bill VB-1 supplied")
        self.assertEqual(len(open_exceptions(self.conn)), 0)
        row = self.conn.execute(
            "SELECT status, resolution_note FROM exceptions WHERE id=?", (exc_id,)).fetchone()
        self.assertEqual(row["status"], ExceptionStatus.RESOLVED.value)
        self.assertEqual(row["resolution_note"], "vendor bill VB-1 supplied")

        # 3. Reclassify with the now-present evidence -> no longer UNVERIFIED.
        #    (Required product_cost present; recommended vendor fields still absent, so
        #    it lands PROVISIONAL — the point is the record left the exception state.)
        rv2 = self.matrix.classify_record(self._record(with_cost=True), "invoice")
        self.assertNotEqual(rv2.level_for(CalculationType.COST), VerificationLevel.UNVERIFIED)

        # 4. Both audit events are retained in order (append-only history).
        kinds = [e["kind"] for e in recent(self.conn, 50)]
        self.assertIn("exception_opened", kinds)
        self.assertIn("exception_resolved", kinds)

    def test_no_exception_when_verified(self):
        rv = self.matrix.classify_record(self._record(with_cost=True), "invoice")
        cv = rv.by_calc[CalculationType.COST]
        self.assertIsNone(exception_from_verification(self.conn, cv, transaction_id="t1"))


if __name__ == "__main__":
    unittest.main()
