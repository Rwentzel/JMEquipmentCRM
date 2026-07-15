"""Duplicate detection: exact and likely (§6). Likely duplicates are never auto-merged."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from decimal import Decimal

from .db import utcnow_iso
from .ids import new_id


def _invoice_number(conn, txn_id) -> str | None:
    r = conn.execute(
        "SELECT value FROM external_identifiers WHERE entity_id=? AND namespace='invoice_number' LIMIT 1",
        (txn_id,)).fetchone()
    return r["value"] if r else None


def _line_amount_minor(conn, txn_id) -> int:
    r = conn.execute(
        """SELECT COALESCE(SUM(COALESCE(quantity_minor,0)/10000.0 * COALESCE(unit_sales_price_minor,0)),0) AS amt
           FROM transaction_lines WHERE transaction_id=?""", (txn_id,)).fetchone()
    return int(round(r["amt"] or 0))


@dataclass
class ExactDup:
    staged_transaction_id: str
    matched_transaction_id: str
    reason: str


@dataclass
class LikelyDup:
    candidate_group_id: str
    transaction_id: str
    other_transaction_id: str
    match_score: str
    matching_fields: list[str]
    conflicting_fields: list[str]
    recommended_disposition: str


def find_exact_duplicates(conn: sqlite3.Connection, batch_id: str) -> list[ExactDup]:
    """Exact = same source-row hash already posted, or same invoice# under same customer posted."""
    out: list[ExactDup] = []
    staged = conn.execute(
        "SELECT * FROM transactions WHERE import_batch_id=? AND posted=0", (batch_id,)).fetchall()
    for t in staged:
        if t["source_row_hash"]:
            m = conn.execute(
                """SELECT id FROM transactions WHERE posted=1 AND source_row_hash=? LIMIT 1""",
                (t["source_row_hash"],)).fetchone()
            if m:
                out.append(ExactDup(t["id"], m["id"], "identical source row already posted"))
                continue
        inv = _invoice_number(conn, t["id"])
        if inv and t["customer_id"]:
            m = conn.execute(
                """SELECT tr.id FROM transactions tr
                   JOIN external_identifiers e ON e.entity_id=tr.id AND e.namespace='invoice_number'
                   WHERE tr.posted=1 AND e.value=? AND tr.customer_id=? AND tr.transaction_type=? LIMIT 1""",
                (inv, t["customer_id"], t["transaction_type"])).fetchone()
            if m:
                out.append(ExactDup(t["id"], m["id"],
                                    f"invoice {inv} for same customer already posted"))
    return out


_SIGNALS = ("customer_id", "transaction_type", "invoice", "amount", "date", "product")


def _signals_for(conn, t) -> dict:
    return {
        "customer_id": t["customer_id"],
        "transaction_type": t["transaction_type"],
        "invoice": _invoice_number(conn, t["id"]),
        "amount": _line_amount_minor(conn, t["id"]),
        "date": t["invoice_date"] or t["transaction_date"],
        "product": (conn.execute(
            "SELECT description FROM transaction_lines WHERE transaction_id=? LIMIT 1",
            (t["id"],)).fetchone() or {"description": None})["description"],
    }


def find_likely_duplicates(conn: sqlite3.Connection, batch_id: str) -> list[LikelyDup]:
    """Explainable pairwise scoring among staged rows (and vs posted). Never merges."""
    staged = conn.execute(
        "SELECT * FROM transactions WHERE import_batch_id=? AND posted=0", (batch_id,)).fetchall()
    posted = conn.execute("SELECT * FROM transactions WHERE posted=1").fetchall()
    sig = {t["id"]: _signals_for(conn, t) for t in staged}
    for p in posted:
        sig[p["id"]] = _signals_for(conn, p)

    out: list[LikelyDup] = []
    pool = list(staged) + list(posted)
    for i, a in enumerate(staged):
        for b in pool:
            if a["id"] == b["id"]:
                continue
            # avoid double-counting staged/staged pairs
            if b in staged and pool.index(b) <= i:
                continue
            sa, sb = sig[a["id"]], sig[b["id"]]
            matching, conflicting = [], []
            for s in _SIGNALS:
                va, vb = sa[s], sb[s]
                if va in (None, "", 0) and vb in (None, "", 0):
                    continue
                if va == vb:
                    matching.append(s)
                else:
                    conflicting.append(s)
            considered = len(matching) + len(conflicting)
            if considered == 0:
                continue
            score = Decimal(len(matching)) / Decimal(considered)
            # Flag as a likely-dup candidate on strong overlap that is not an exact dup.
            if score >= Decimal("0.6") and "customer_id" in matching and \
               ("invoice" in matching or "amount" in matching):
                disp = "review — likely duplicate" if not conflicting else "review — conflicting duplicate"
                out.append(LikelyDup(
                    new_id("reconciliation_finding"), a["id"], b["id"],
                    format(score, "f"), matching, conflicting, disp))
    return out


def persist_duplicates(conn: sqlite3.Connection, likely: list[LikelyDup],
                       batch_id: str | None = None) -> int:
    for d in likely:
        conn.execute(
            """INSERT INTO duplicate_candidates(id, candidate_group_id, transaction_id,
               other_transaction_id, match_score, matching_fields_json, conflicting_fields_json,
               recommended_disposition, review_status, import_batch_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)""",
            (new_id("reconciliation_finding"), d.candidate_group_id, d.transaction_id,
             d.other_transaction_id, d.match_score, json.dumps(d.matching_fields),
             json.dumps(d.conflicting_fields), d.recommended_disposition, batch_id, utcnow_iso()))
    return len(likely)
