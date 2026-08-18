"""Controlled configuration: settings, versioned policies, versioned commission rules."""

import unittest

from finance_system import config
from finance_system.audit import recent
from finance_system.mapping import MappingProfile
from finance_system.policies import DEFAULT_POLICY, CalculationPolicy
from finance_system.db import utcnow_iso
from finance_system.ids import new_id
from tests.helpers import fresh_db


class TestConfig(unittest.TestCase):
    def setUp(self):
        self.conn = fresh_db()
        config.bootstrap(self.conn, actor="setup")

    def tearDown(self):
        self.conn.close()

    def test_settings_roundtrip_and_audit(self):
        self.assertEqual(config.get_setting(self.conn, "retention_months"), "24")
        config.set_setting(self.conn, "retention_months", "36", actor="riley")
        self.assertEqual(config.get_setting(self.conn, "retention_months"), "36")
        self.assertIn("setting_changed", [e["kind"] for e in recent(self.conn, 50)])

    def test_unknown_setting_rejected(self):
        with self.assertRaises(KeyError):
            config.set_setting(self.conn, "not_a_setting", "x")

    def test_historical_policy_version_cannot_be_overwritten(self):
        with self.assertRaises(ValueError) as ctx:
            config.record_policy(self.conn, DEFAULT_POLICY)
        self.assertIn("bump the version", str(ctx.exception))

    def test_new_policy_version_supersedes_without_editing_history(self):
        v2 = CalculationPolicy(**{**{f.name: getattr(DEFAULT_POLICY, f.name)
                                     for f in DEFAULT_POLICY.__dataclass_fields__.values()},
                                  "version": 2})
        config.record_policy(self.conn, v2, active=True, note="fy27 policy", actor="riley")
        hist = config.policy_history(self.conn, DEFAULT_POLICY.name)
        self.assertEqual([h["version"] for h in hist], [1, 2])
        self.assertEqual([h["active"] for h in hist], [0, 1])   # v1 retained, deactivated
        self.assertEqual(config.active_policy_version(self.conn, DEFAULT_POLICY.name), 2)

    def test_commission_rule_versions_supersede_not_mutate(self):
        config.upsert_commission_rule(self.conn, source_code="CR-GP10", name="GP 10%",
                                      basis="gross_profit", rate="10%", actor="op")
        config.upsert_commission_rule(self.conn, source_code="CR-GP10", name="GP 12%",
                                      basis="gross_profit", rate="0.12", actor="op")
        active = config.commission_rules(self.conn)
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0]["version"], 2)
        self.assertEqual(active[0]["rate_canonical"], "0.12")
        self.assertEqual(len(config.commission_rules(self.conn, include_inactive=True)), 2)
        # the superseded version is still readable (historical results stay explicable)
        old = [r for r in config.commission_rules(self.conn, include_inactive=True)
               if r["version"] == 1][0]
        self.assertEqual(old["rate_canonical"], "0.1")

    def test_percent_rate_is_normalized(self):
        config.upsert_commission_rule(self.conn, source_code="CR-R5", name="Rev 5%",
                                      basis="revenue", rate="5%")
        self.assertEqual(config.commission_rules(self.conn)[0]["rate_canonical"], "0.05")

    def test_active_rule_lookup_feeds_intake(self):
        config.upsert_commission_rule(self.conn, source_code="CR-GP10", name="v1",
                                      basis="gross_profit", rate="0.10")
        rid = config.upsert_commission_rule(self.conn, source_code="CR-GP10", name="v2",
                                            basis="gross_profit", rate="0.11")
        self.assertEqual(config.active_rule_lookup(self.conn)["CR-GP10"], rid)

    def test_mapping_profile_save_and_load(self):
        prof = MappingProfile(id=new_id("import_batch"), name="acme-csv",
                              created_at=utcnow_iso(), updated_at=utcnow_iso())
        config.save_mapping_profile(self.conn, prof, actor="op")
        loaded = config.load_mapping_profile(self.conn, "acme-csv")
        self.assertEqual(loaded.name, "acme-csv")
        self.assertEqual(loaded.required_fields, prof.required_fields)
        self.assertTrue(config.mapping_profiles(self.conn))
        with self.assertRaises(KeyError):
            config.load_mapping_profile(self.conn, "no-such-profile")

    def test_evidence_acceptance_is_configurable_and_audited(self):
        acc = config.evidence_acceptance(self.conn, DEFAULT_POLICY.key())
        self.assertEqual(acc["purchase_order"], "provisional")
        config.set_evidence_acceptance(self.conn, DEFAULT_POLICY.key(), "purchase_order",
                                       "verified", actor="riley")
        acc = config.evidence_acceptance(self.conn, DEFAULT_POLICY.key())
        self.assertEqual(acc["purchase_order"], "verified")
        self.assertIn("evidence_acceptance_changed", [e["kind"] for e in recent(self.conn, 50)])


if __name__ == "__main__":
    unittest.main()
