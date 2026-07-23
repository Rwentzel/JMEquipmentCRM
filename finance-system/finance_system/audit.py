"""Append-only audit API.

Mirrors the repo's ``auditLog.ts`` discipline: events carry a kind, timestamp, and a
NON-confidential structural summary only — never raw customer/pricing/cost strings
(Correction #7: no raw source data in logs; redaction-safe). The DB enforces
append-only via triggers (see migration); this module never issues UPDATE/DELETE.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any

from .db import utcnow_iso
from .ids import new_id

# Fields that must never appear verbatim in an audit detail payload.
_FORBIDDEN_DETAIL_KEYS = frozenset(
    {"raw", "raw_json", "unit_sales_price", "product_cost", "price", "cost",
     "margin", "commission_rate", "email", "phone", "bank", "tax_id"}
)


def _safe_detail(detail: dict[str, Any] | None) -> str | None:
    if detail is None:
        return None
    for key in detail:
        if key.lower() in _FORBIDDEN_DETAIL_KEYS:
            raise ValueError(
                f"refusing to audit confidential key {key!r}; log structural summaries only"
            )
    return json.dumps(detail, sort_keys=True, default=str)


def record_event(
    conn: sqlite3.Connection,
    kind: str,
    summary: str,
    *,
    entity_kind: str | None = None,
    entity_id: str | None = None,
    detail: dict[str, Any] | None = None,
    actor: str | None = None,
) -> str:
    """Append one audit event; returns its id. Raises if detail carries confidential keys."""
    event_id = new_id("audit_event")
    conn.execute(
        """INSERT INTO audit_events
           (id, kind, entity_kind, entity_id, summary, detail_json, actor, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (event_id, kind, entity_kind, entity_id, summary, _safe_detail(detail),
         actor, utcnow_iso()),
    )
    return event_id


def events_for(conn: sqlite3.Connection, entity_kind: str, entity_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        """SELECT * FROM audit_events
           WHERE entity_kind = ? AND entity_id = ? ORDER BY created_at, id""",
        (entity_kind, entity_id),
    ).fetchall()


def recent(conn: sqlite3.Connection, limit: int = 200) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM audit_events ORDER BY created_at DESC, id DESC LIMIT ?",
        (limit,),
    ).fetchall()
