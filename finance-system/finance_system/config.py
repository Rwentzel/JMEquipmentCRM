"""Controlled configuration (Exchange 3).

Operator-editable settings, versioned calculation policies, versioned commission rules,
saved mapping profiles, and evidence-acceptance configuration.

The governing rule: **historical policy versions are never edited.** A policy change writes
a NEW version and marks it active; snapshots that reference an earlier version stay exactly
reproducible. Every change is written to the append-only audit log.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from typing import Optional

from . import audit, cost_evidence
from .db import utcnow_iso
from .ids import new_id
from .mapping import MappingProfile
from .normalize import normalize_percent
from .policies import CalculationPolicy, DEFAULT_POLICY

# ---- settings --------------------------------------------------------------
DEFAULT_SETTINGS = {
    "export_directory": "",            # blank = the gitignored private .data/exports
    "backup_directory": "",            # blank = alongside the active database
    "default_reporting_basis": "invoiced",
    "money_tolerance": "0.01",
    "retention_months": "24",
}


def get_setting(conn: sqlite3.Connection, key: str) -> str:
    row = conn.execute("SELECT value FROM app_settings WHERE key=?", (key,)).fetchone()
    if row:
        return row["value"]
    if key in DEFAULT_SETTINGS:
        return DEFAULT_SETTINGS[key]
    raise KeyError(f"unknown setting {key!r}")


def all_settings(conn: sqlite3.Connection) -> dict:
    out = dict(DEFAULT_SETTINGS)
    for r in conn.execute("SELECT key, value FROM app_settings"):
        out[r["key"]] = r["value"]
    return out


def set_setting(conn: sqlite3.Connection, key: str, value: str,
                actor: str | None = None) -> None:
    if key not in DEFAULT_SETTINGS:
        raise KeyError(f"unknown setting {key!r}; known: {', '.join(sorted(DEFAULT_SETTINGS))}")
    conn.execute(
        """INSERT INTO app_settings(key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at,
           updated_by=excluded.updated_by""",
        (key, str(value), utcnow_iso(), actor))
    audit.record_event(conn, "setting_changed", f"{key} updated",
                       entity_kind="app_setting", entity_id=key, actor=actor,
                       detail={"key": key})


# ---- versioned policies ----------------------------------------------------
def record_policy(conn: sqlite3.Connection, policy: CalculationPolicy, *, active: bool = True,
                  note: str | None = None, actor: str | None = None) -> str:
    """Store a policy version. Refuses to overwrite an existing (name, version)."""
    existing = conn.execute(
        "SELECT id FROM policy_versions WHERE name=? AND version=?",
        (policy.name, policy.version)).fetchone()
    if existing:
        raise ValueError(
            f"policy {policy.name} v{policy.version} already exists — bump the version "
            f"instead of editing history")
    pid = new_id("evidence_requirement")
    if active:
        conn.execute("UPDATE policy_versions SET active=0 WHERE name=?", (policy.name,))
    conn.execute(
        """INSERT INTO policy_versions(id, name, version, policy_json, active, note,
           created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (pid, policy.name, policy.version, json.dumps(asdict(policy), default=str),
         1 if active else 0, note, actor, utcnow_iso()))
    audit.record_event(conn, "policy_version_recorded", f"{policy.key()} recorded",
                       entity_kind="calculation_policy", entity_id=pid, actor=actor,
                       detail={"policy": policy.key(), "active": active})
    return pid


def policy_history(conn: sqlite3.Connection, name: str | None = None) -> list:
    sql = """SELECT name, version, active, note, created_by, created_at FROM policy_versions"""
    params: tuple = ()
    if name:
        sql += " WHERE name=?"
        params = (name,)
    sql += " ORDER BY name, version"
    return [dict(r) for r in conn.execute(sql, params)]


def active_policy_version(conn: sqlite3.Connection, name: str) -> Optional[int]:
    row = conn.execute(
        "SELECT version FROM policy_versions WHERE name=? AND active=1", (name,)).fetchone()
    return row["version"] if row else None


# ---- versioned commission rules -------------------------------------------
def upsert_commission_rule(
    conn: sqlite3.Connection, *, source_code: str, name: str, basis: str, rate: str,
    eligibility: str = "on_invoice", actor: str | None = None,
) -> str:
    """Create or supersede a commission rule.

    An existing rule is never edited in place: the current version is deactivated and a new
    version is inserted, so historical commission calculations remain explicable.
    """
    parsed = normalize_percent(rate)          # accepts "10%", "0.10", Decimal-like strings
    if not parsed.ok:
        raise ValueError(f"invalid commission rate {rate!r} (use e.g. '10%' or '0.10')")
    canonical_rate = parsed.value
    current = conn.execute(
        """SELECT id, version FROM commission_rules WHERE source_code=? AND active=1
           ORDER BY version DESC LIMIT 1""", (source_code,)).fetchone()
    version = (current["version"] + 1) if current else 1
    rid = new_id("commission_rule")
    if current:
        conn.execute("UPDATE commission_rules SET active=0 WHERE id=?", (current["id"],))
    conn.execute(
        """INSERT INTO commission_rules(id, name, basis, rate_canonical, eligibility, version,
           active, source_code, superseded_rule_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
        (rid, name, basis, canonical_rate, eligibility, version, source_code,
         current["id"] if current else None, utcnow_iso()))
    audit.record_event(conn, "commission_rule_versioned",
                       f"{source_code} v{version} ({basis} @ {canonical_rate})",
                       entity_kind="commission_rule", entity_id=rid, actor=actor,
                       detail={"source_code": source_code, "version": version})
    return rid


def commission_rules(conn: sqlite3.Connection, include_inactive: bool = False) -> list:
    sql = """SELECT id, source_code, name, basis, rate_canonical, eligibility, version, active
             FROM commission_rules"""
    if not include_inactive:
        sql += " WHERE active=1"
    sql += " ORDER BY source_code, version"
    return [dict(r) for r in conn.execute(sql)]


def active_rule_lookup(conn: sqlite3.Connection) -> dict:
    """source_code -> active rule id, for intake."""
    return {r["source_code"]: r["id"] for r in conn.execute(
        "SELECT source_code, id FROM commission_rules WHERE active=1 AND source_code IS NOT NULL")}


# ---- mapping profiles ------------------------------------------------------
def save_mapping_profile(conn: sqlite3.Connection, profile: MappingProfile,
                         actor: str | None = None) -> str:
    """Persist a mapping profile version (name+version is unique)."""
    conn.execute(
        """INSERT INTO mapping_profiles(id, name, source_type, profile_json, version,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(name, version) DO UPDATE SET profile_json=excluded.profile_json,
           updated_at=excluded.updated_at""",
        (profile.id, profile.name, profile.source_type, profile.to_json(), profile.version,
         profile.created_at or utcnow_iso(), utcnow_iso()))
    audit.record_event(conn, "mapping_profile_saved", f"{profile.name} v{profile.version}",
                       entity_kind="mapping_profile", entity_id=profile.id, actor=actor)
    return profile.id


def load_mapping_profile(conn: sqlite3.Connection, name: str,
                         version: int | None = None) -> MappingProfile:
    if version is None:
        row = conn.execute(
            "SELECT profile_json FROM mapping_profiles WHERE name=? ORDER BY version DESC LIMIT 1",
            (name,)).fetchone()
    else:
        row = conn.execute(
            "SELECT profile_json FROM mapping_profiles WHERE name=? AND version=?",
            (name, version)).fetchone()
    if row is None:
        raise KeyError(f"no mapping profile named {name!r}")
    return MappingProfile.from_json(row["profile_json"])


def mapping_profiles(conn: sqlite3.Connection) -> list:
    return [dict(r) for r in conn.execute(
        "SELECT name, source_type, version, updated_at FROM mapping_profiles ORDER BY name, version")]


# ---- evidence acceptance ---------------------------------------------------
def evidence_acceptance(conn: sqlite3.Connection, policy_key: str) -> dict:
    cost_evidence.install_default_policy(conn, policy_key)
    return {r["evidence_type"]: r["satisfies"] for r in conn.execute(
        "SELECT evidence_type, satisfies FROM cost_evidence_policy WHERE policy_key=? ORDER BY evidence_type",
        (policy_key,))}


def set_evidence_acceptance(conn: sqlite3.Connection, policy_key: str, evidence_type: str,
                            satisfies: str, actor: str | None = None) -> None:
    cost_evidence.set_acceptance(conn, policy_key, evidence_type, satisfies)
    audit.record_event(conn, "evidence_acceptance_changed",
                       f"{evidence_type} -> {satisfies}", entity_kind="cost_evidence_policy",
                       entity_id=policy_key, actor=actor,
                       detail={"evidence_type": evidence_type, "satisfies": satisfies})


def bootstrap(conn: sqlite3.Connection, actor: str | None = None) -> dict:
    """Seed configuration for a fresh install (idempotent)."""
    if not conn.execute("SELECT 1 FROM policy_versions WHERE name=? AND version=?",
                        (DEFAULT_POLICY.name, DEFAULT_POLICY.version)).fetchone():
        record_policy(conn, DEFAULT_POLICY, active=True, note="default policy", actor=actor)
    seeded = cost_evidence.install_default_policy(conn, DEFAULT_POLICY.key())
    return {"policy": DEFAULT_POLICY.key(), "evidence_types_seeded": seeded,
            "settings": all_settings(conn)}
