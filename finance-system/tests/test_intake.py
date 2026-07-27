"""Intake parsing: CSV variants, pasted, JSON, malformed, edge cases."""

import unittest

from finance_system import parsing
from finance_system.normalize import (
    normalize_money, normalize_date, normalize_percent, normalize_transaction_type,
)


class TestParsing(unittest.TestCase):
    def test_standard_csv(self):
        r = parsing.parse_delimited("a,b\n1,2\n3,4\n", ",")
        self.assertEqual(r.headers, ["a", "b"])
        self.assertEqual(len(r.rows), 2)
        self.assertEqual(r.rows[0], {"a": "1", "b": "2"})

    def test_quoted_commas(self):
        r = parsing.parse_delimited('name,note\n"Doe, John","a, b, c"\n', ",")
        self.assertEqual(r.rows[0]["name"], "Doe, John")
        self.assertEqual(r.rows[0]["note"], "a, b, c")

    def test_empty_rows_skipped(self):
        r = parsing.parse_delimited("a,b\n1,2\n\n,\n3,4\n", ",")
        self.assertEqual(len(r.rows), 2)

    def test_duplicate_headers_deduped(self):
        r = parsing.parse_delimited("amt,amt\n1,2\n", ",")
        self.assertEqual(r.headers, ["amt", "amt__2"])
        self.assertTrue(any("duplicate header" in w for w in r.warnings))

    def test_ragged_row_extra_cells_warned(self):
        r = parsing.parse_delimited("a,b\n1,2,3\n", ",")
        self.assertTrue(any("extra ignored" in w for w in r.warnings))

    def test_pasted_tsv_detected(self):
        r = parsing.parse_pasted("a\tb\n1\t2\n")
        self.assertEqual(r.headers, ["a", "b"])
        self.assertEqual(r.rows[0], {"a": "1", "b": "2"})

    def test_pasted_csv_detected(self):
        r = parsing.parse_pasted("a,b\n1,2\n")
        self.assertEqual(r.rows[0], {"a": "1", "b": "2"})

    def test_json_array(self):
        r = parsing.parse_json('[{"a":1,"b":2},{"a":3}]')
        self.assertIn("a", r.headers)
        self.assertEqual(r.rows[1]["b"], "")  # missing key -> empty

    def test_detect_format(self):
        self.assertEqual(parsing.detect_format("x.json", b"[]"), "json")
        self.assertEqual(parsing.detect_format("x.tsv", b"a\tb"), "tsv")
        self.assertEqual(parsing.detect_format("x.xlsx", b"PK\x03\x04"), "xlsx")
        self.assertEqual(parsing.detect_format("x.csv", b"a,b"), "csv")

    def test_xlsx_gated_when_unavailable(self):
        try:
            import openpyxl  # noqa: F401
            self.skipTest("openpyxl installed; gating path not exercised")
        except ImportError:
            with self.assertRaises(parsing.ExcelUnavailable):
                parsing.parse_xlsx(b"PK\x03\x04 not a real xlsx")


class TestNormalize(unittest.TestCase):
    def test_money_variants(self):
        self.assertEqual(normalize_money("$1,250.00").value, "1250.00")
        self.assertEqual(normalize_money("(40.00)").value, "-40.00")
        self.assertFalse(normalize_money("abc").ok)

    def test_dates(self):
        self.assertEqual(normalize_date("06/05/2026").value, "2026-06-05")
        self.assertEqual(normalize_date("2026-06-05").value, "2026-06-05")
        self.assertFalse(normalize_date("not a date").ok)

    def test_percent(self):
        self.assertEqual(normalize_percent("10%").value, "0.1")
        self.assertEqual(normalize_percent("0.05").value, "0.05")

    def test_transaction_type_synonyms_and_unknown(self):
        self.assertEqual(normalize_transaction_type("Sales Order").value, "sales_order")
        self.assertEqual(normalize_transaction_type("CM").value, "credit_memo")
        u = normalize_transaction_type("Widget Thing")
        self.assertEqual(u.value, "unknown")
        self.assertFalse(u.ok)


if __name__ == "__main__":
    unittest.main()
