"""Calculation-snapshot persistence (Defect 1).

Every material calculated result on a posted transaction is written here as an
immutable row in ``calculation_snapshots``. The table is append-only (DB triggers). A
correction or policy change creates a NEW snapshot whose ``superseded_snapshot_id``
points at the prior one — the original is never overwritten.

Each snapshot retains: id, entity type/id, transaction-line id, calculation name,
formula version, policy id + version, input values, output value + kind + scale,
verification state, evidence basis, reporting period, import batch, timestamp, and the
superseded-snapshot reference where applicable.
"""

from __future__ import annotations

import json
import sqlite3
from decimal import Decimal
from typing import Any, Optional

from .db import utcnow_iso
from .ids import new_id
from .money import Money
from .policies import CalculationPolicy

FORMULA_VERSION = "1"

# The material calculation names persisted on posting.
CALC_GROSS_LINE_REVENUE = "gross_line_revenue"
CALC_NET_LINE_REVENUE = "net_line_revenue"
CALC_RECOGNIZED_REVENUE = "recognized_revenue"
CALC_PRODUCT_COST = "product_cost"
CALC_TOTAL_ACTUAL_COST = "total_actual_cost"
CALC_GROSS_PROFIT = "gross_profit"
CALC_GROSS_MARGIN = "gross_margin"
CALC_MARKUP = "markup"
CALC_UNIT_COST = "unit_cost"
CALC_UNIT_GROSS_PROFIT = "unit_gross_profit"
CALC_COMMISSION_BASIS = "commission_basis"
CALC_COMMISSION_AMOUNT = "commission_amount"
CALC_CONTRIBUTION_AFTER_COMMISSION = "contribution_after_commission"
CALC_FREIGHT_RECOVERY = "freight_recovery"
CALC_CRATING_RECOVERY = "crating_recovery"


def _fmt_inputs(inputs: dict[str, Any]) -> str:
    """Serialize inputs as canonical strings (Money -> minor int str; Decimal -> str)."""
    out: dict[str, Any] = {}
    for k, v in inputs.items():
        if isinstance(v, Money):
            out[k] = {"minor": v.minor, "currency": v.currency}
        elif isinstance(v, Decimal):
            out[k] = str(v)
        else:
            out[k] = v
    return json.dumps(out, sort_keys=True, default=str)


def persist_snapshot(
    conn: sqlite3.Connection,
    *,
    calculation_name: str,
    entity_type: str,
    entity_id: str,
    inputs: dict[str, Any],
    output_value: str,
    output_kind: str,               # money_minor | decimal | percent | none
    verification_state: str,
    policy: CalculationPolicy,
    reporting_period_id: Optional[str] = None,
    import_batch_id: Optional[str] = None,
    source_transaction_id: Optional[str] = None,
    source_line_id: Optional[str] = None,
    evidence_basis: Optional[str] = None,
    output_scale: Optional[int] = None,
    currency: str = "USD",
    superseded_snapshot_id: Optional[str] = None,
) -> str:
    """Append one immutable calculation snapshot; returns its id."""
    snap_id = new_id("calculation_snapshot")
    conn.execute(
        """INSERT INTO calculation_snapshots
           (id, calculation_type, calculation_name, policy_key, policy_id, policy_version,
            formula_version, inputs_json, output_value, output_kind, output_scale, currency,
            verification_level, evidence_basis, entity_type, entity_id,
            source_transaction_id, source_line_id, reporting_period_id, import_batch_id,
            superseded_snapshot_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (snap_id, calculation_name, calculation_name, policy.key(), policy.name,
         policy.version, FORMULA_VERSION, _fmt_inputs(inputs), output_value, output_kind,
         output_scale, currency, verification_state, evidence_basis, entity_type, entity_id,
         source_transaction_id, source_line_id, reporting_period_id, import_batch_id,
         superseded_snapshot_id, utcnow_iso()),
    )
    return snap_id


def history(
    conn: sqlite3.Connection, entity_type: str, entity_id: str, calculation_name: str
) -> list[sqlite3.Row]:
    """All snapshots for a calculation, oldest first (append-only history)."""
    return conn.execute(
        """SELECT * FROM calculation_snapshots
           WHERE entity_type = ? AND entity_id = ? AND calculation_name = ?
           ORDER BY created_at, id""",
        (entity_type, entity_id, calculation_name),
    ).fetchall()


def latest(
    conn: sqlite3.Connection, entity_type: str, entity_id: str, calculation_name: str
) -> Optional[sqlite3.Row]:
    """Most recent (current) snapshot for a calculation, or None."""
    return conn.execute(
        """SELECT * FROM calculation_snapshots
           WHERE entity_type = ? AND entity_id = ? AND calculation_name = ?
           ORDER BY created_at DESC, id DESC LIMIT 1""",
        (entity_type, entity_id, calculation_name),
    ).fetchone()


def count_for_transaction(conn: sqlite3.Connection, transaction_id: str) -> int:
    return conn.execute(
        "SELECT COUNT(*) FROM calculation_snapshots WHERE source_transaction_id = ?",
        (transaction_id,),
    ).fetchone()[0]


# --- Centralized current-snapshot selection (Exchange 2.1, gate item 9) ------
# One authoritative definition, reused everywhere. "Current for now" = the row that was
# not later superseded. "Current as of T" = the latest row created at/before T for that
# (entity, calculation).

NOT_SUPERSEDED_SQL = (
    "cs.id NOT IN (SELECT superseded_snapshot_id FROM calculation_snapshots "
    "WHERE superseded_snapshot_id IS NOT NULL)")


def current_snapshots(
    conn: sqlite3.Connection, *, as_of: str | None = None,
    calculation_name: str | None = None, transaction_ids: tuple[str, ...] | None = None,
) -> list[sqlite3.Row]:
    """Return the current snapshot per (entity, calculation), optionally as of a timestamp
    and filtered by calculation name / source transaction. This is THE current-snapshot
    query; callers must not re-derive it."""
    params: list = []
    if as_of is None:
        sql = f"SELECT cs.* FROM calculation_snapshots cs WHERE {NOT_SUPERSEDED_SQL}"
    else:
        sql = (
            "SELECT cs.* FROM calculation_snapshots cs WHERE cs.created_at <= ? "
            "AND NOT EXISTS (SELECT 1 FROM calculation_snapshots s2 "
            "WHERE s2.entity_type=cs.entity_type AND s2.entity_id=cs.entity_id "
            "AND s2.calculation_name=cs.calculation_name AND s2.created_at <= ? "
            "AND (s2.created_at > cs.created_at OR (s2.created_at=cs.created_at AND s2.id>cs.id)))")
        params.extend([as_of, as_of])
    if calculation_name:
        sql += " AND cs.calculation_name = ?"
        params.append(calculation_name)
    if transaction_ids:
        sql += f" AND cs.source_transaction_id IN ({','.join('?' * len(transaction_ids))})"
        params.extend(transaction_ids)
    return conn.execute(sql, params).fetchall()


def assert_single_current(conn: sqlite3.Connection) -> None:
    """Invariant: at most one non-superseded snapshot per (entity, calculation)."""
    dupes = conn.execute(
        f"""SELECT entity_type, entity_id, calculation_name, COUNT(*) AS n
            FROM calculation_snapshots cs WHERE {NOT_SUPERSEDED_SQL}
            GROUP BY entity_type, entity_id, calculation_name HAVING n > 1""").fetchall()
    if dupes:
        raise AssertionError(
            f"multiple current snapshots for {len(dupes)} (entity, calculation) contexts")
