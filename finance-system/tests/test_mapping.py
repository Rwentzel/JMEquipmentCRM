"""Mapping profiles + header mapping confidence."""

import unittest

from finance_system.mapping import MappingProfile, map_headers, MapConfidence
from finance_system.ids import new_id


class TestMapping(unittest.TestCase):
    def _profile(self):
        return MappingProfile(id=new_id("import_batch"), name="p", created_at="t", updated_at="t")

    def test_exact_and_strong(self):
        res = map_headers(["customer", "Unit Price"], self._profile())
        self.assertEqual(res.confidence["customer"], MapConfidence.EXACT.value)
        self.assertEqual(res.confidence["unit_sales_price"], MapConfidence.STRONG.value)

    def test_unmapped_header(self):
        res = map_headers(["customer", "Zed Field XYZ"], self._profile())
        self.assertIn("Zed Field XYZ", res.unmapped_headers)

    def test_ambiguous_when_two_headers_same_dest(self):
        res = map_headers(["Invoice #", "Invoice Number"], self._profile())
        self.assertIn("external_invoice_number", res.ambiguous)

    def test_missing_critical_field(self):
        res = map_headers(["vendor"], self._profile())  # no customer/qty/price/type
        for crit in ("transaction_type", "customer", "quantity", "unit_sales_price"):
            self.assertIn(crit, res.missing_critical)
        self.assertTrue(res.is_reviewable())

    def test_profile_json_roundtrip_and_version(self):
        p = self._profile()
        p2 = MappingProfile.from_json(p.to_json())
        self.assertEqual(p2.name, p.name)
        self.assertEqual(p2.version, 1)
        self.assertEqual(p2.required_fields, p.required_fields)


if __name__ == "__main__":
    unittest.main()
