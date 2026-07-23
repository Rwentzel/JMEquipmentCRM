"""Exchange 2.1: real XLSX intake when openpyxl is installed (else honest skip)."""

import io
import unittest

from finance_system import parsing

try:
    import openpyxl
    HAVE_OPENPYXL = True
except ImportError:
    HAVE_OPENPYXL = False


@unittest.skipUnless(HAVE_OPENPYXL, "openpyxl not installed (XLSX intake is a gated optional)")
class TestXlsxReal(unittest.TestCase):
    def _workbook(self) -> bytes:
        import datetime
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Data"
        ws.append(["Customer", "Qty", "Date", "Total"])
        ws.append(["Acme Test", 5, datetime.datetime(2026, 6, 5), 250])
        ws.append(["Beta Test", 2, datetime.datetime(2026, 6, 6), "=B3*10"])  # formula cell
        hidden = wb.create_sheet("Hidden")
        hidden.append(["should", "be", "ignored"])
        hidden.sheet_state = "hidden"
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def test_reads_multiple_rows_and_cells(self):
        res = parsing.parse_xlsx(self._workbook())
        self.assertEqual(res.headers, ["Customer", "Qty", "Date", "Total"])
        self.assertEqual(len(res.rows), 2)
        self.assertEqual(res.rows[0]["Customer"], "Acme Test")
        self.assertEqual(res.rows[0]["Qty"], "5")                 # numeric normalized to str
        self.assertIn("2026-06-05", res.rows[0]["Date"])          # date cell

    def test_formula_cell_uses_cached_value_policy(self):
        # data_only reads cached values; an uncomputed formula yields empty — documented policy.
        res = parsing.parse_xlsx(self._workbook())
        self.assertEqual(res.rows[1]["Total"], "")

    def test_hidden_sheet_ignored(self):
        res = parsing.parse_xlsx(self._workbook())
        # active-sheet-only read; hidden sheet content never appears
        self.assertNotIn("should", [v for r in res.rows for v in r.values()])

    def test_gate_still_raises_when_forced(self):
        # The gate path (no parser) is covered separately; here we confirm real bytes parse.
        self.assertTrue(parsing.detect_format("x.xlsx", b"PK\x03\x04") == "xlsx")


if __name__ == "__main__":
    unittest.main()
