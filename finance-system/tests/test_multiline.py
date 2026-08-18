"""Multi-line documents: one invoice with many lines is ONE document."""

import unittest

from finance_system import batch_report, cash, dedup, pipeline
from finance_system.money import Money
from finance_system.policies import DEFAULT_POLICY
from finance_system.scope import ReportScope
from tests.helpers import fresh_db, import_content, make_period, seed_rules

MULTILINE_CSV = (
    b"Type,Customer,Item,Invoice #,Date,Period Date,Qty,Unit Price,Total,Cost,Crating Billed,Crating\n"
    # ONE invoice, THREE lines (header total 600 = 200 + 300 + 100)
    b"Invoice,Multi Test Co,Part A,INV-8001,2026-06-03,2026-06-03,2,100.00,600.00,120.00,0,0\n"
    b"Invoice,Multi Test Co,Part B,INV-8001,2026-06-03,2026-06-03,3,100.00,,150.00,0,0\n"
    b"Invoice,Multi Test Co,Part C,INV-8001,2026-06-03,2026-06-03,1,100.00,,40.00,25.00,20.00\n"
    # a separate single-line invoice
    b"Invoice,Other Test Co,Part D,INV-8002,2026-06-04,2026-06-04,1,50.00,50.00,25.00,0,0\n"
)


class TestMultiLine(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        rules = seed_rules(self.conn)
        self.pid = make_period(self.conn)
        self.batch = import_content(self.conn, MULTILINE_CSV, period_id=self.pid, rules=rules,
                                    filename="multi.csv")

    def tearDown(self):
        self.conn.close()

    def test_three_rows_become_one_document_with_three_lines(self):
        docs = self.conn.execute(
            "SELECT id, line_count FROM transactions WHERE import_batch_id=? ORDER BY line_count DESC",
            (self.batch,)).fetchall()
        self.assertEqual(len(docs), 2)              # two invoices, not four transactions
        self.assertEqual(docs[0]["line_count"], 3)  # INV-8001 carries three lines
        self.assertEqual(docs[1]["line_count"], 1)
        lines = self.conn.execute(
            """SELECT COUNT(*) FROM transaction_lines l JOIN transactions t ON t.id=l.transaction_id
               WHERE t.import_batch_id=?""", (self.batch,)).fetchone()[0]
        self.assertEqual(lines, 4)

    def test_line_numbers_are_sequential_within_document(self):
        nums = [r[0] for r in self.conn.execute(
            """SELECT l.line_number FROM transaction_lines l JOIN transactions t ON t.id=l.transaction_id
               WHERE t.line_count=3 ORDER BY l.line_number""")]
        self.assertEqual(nums, [1, 2, 3])

    def test_multi_line_document_is_not_a_duplicate(self):
        """Sharing an invoice number across lines must NOT read as a duplicate document."""
        exact = dedup.find_exact_duplicates(self.conn, self.batch)
        self.assertEqual(exact, [])
        rejected = self.conn.execute(
            "SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND review_status='rejected'",
            (self.batch,)).fetchone()[0]
        self.assertEqual(rejected, 0)

    def test_each_line_keeps_its_own_source_lineage(self):
        rows = self.conn.execute(
            """SELECT l.source_record_id, l.source_row_hash FROM transaction_lines l
               JOIN transactions t ON t.id=l.transaction_id WHERE t.line_count=3""").fetchall()
        ids = {r["source_record_id"] for r in rows}
        hashes = {r["source_row_hash"] for r in rows}
        self.assertEqual(len(ids), 3)      # distinct source rows preserved per line
        self.assertEqual(len(hashes), 3)

    def test_header_total_reconciles_against_all_lines(self):
        """600 header vs 2x100 + 3x100 + 1x100 = 600 -> no header/line mismatch."""
        rules = {r["rule"] for r in self.conn.execute(
            "SELECT rule FROM reconciliation_findings WHERE finding_type='conflict'")}
        self.assertNotIn("header_line_mismatch", rules)

    def test_document_level_totals_include_every_line(self):
        inv = self.conn.execute(
            "SELECT id FROM transactions WHERE line_count=3").fetchone()["id"]
        # 600 revenue + 25 crating billed = 625 invoiced
        self.assertEqual(cash.invoice_total(self.conn, inv), Money.of("625.00"))

    def test_report_distinguishes_documents_from_lines(self):
        rep = batch_report.build_report(
            self.conn, ReportScope.for_batch(self.pid, self.batch, DEFAULT_POLICY), DEFAULT_POLICY)
        a = rep["A_intake"]
        self.assertEqual(a["rows_received"], 4)
        self.assertEqual(a["documents_staged"], 2)
        self.assertEqual(a["lines_staged"], 4)
        self.assertEqual(a["multi_line_documents"], 1)
        self.assertTrue(rep["integrity"]["ok"])


if __name__ == "__main__":
    unittest.main()
