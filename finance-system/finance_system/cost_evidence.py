"""Configurable vendor-cost evidence (Exchange 3).

Cost verification must not universally require a vendor bill: a purchase order, vendor
quote, approved historical cost, authorized manual cost, manufacturer price list, freight
or crating invoice, or an internal labor record may satisfy policy instead. Which types
satisfy verification (and at what strength) is configurable and versioned per policy.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Optional

from .db import utcnow_iso
from .ids import new_id
from .money import Money

# Evidence types the system understands.
VENDOR_BILL = "vendor_bill"
PURCHASE_ORDER = "purchase_order"
VENDOR_QUOTE = "vendor_quote"
HISTORICAL_APPROVED_COST = "historical_approved_cost"
AUTHORIZED_MANUAL_COST = "authorized_manual_cost"
MANUFACTURER_PRICE_LIST = "manufacturer_price_list"
FREIGHT_INVOICE = "freight_invoice"
CRATING_INVOICE = "crating_invoice"
INTERNAL_LABOR_RECORD = "internal_labor_record"

ALL_TYPES = (VENDOR_BILL, PURCHASE_ORDER, VENDOR_QUOTE, HISTORICAL_APPROVED_COST,
             AUTHORIZED_MANUAL_COST, MANUFACTURER_PRICE_LIST, FREIGHT_INVOICE,
             CRATING_INVOICE, INTERNAL_LABOR_RECORD)

# Default posture: settled documents verify; forward-looking or estimated ones are
# provisional (visible, qualified, never silently "verified").
DEFAULT_POLICY_MAP = {
    VENDOR_BILL: "verified",
    FREIGHT_INVOICE: "verified",
    CRATING_INVOICE: "verified",
    INTERNAL_LABOR_RECORD: "verified",
    AUTHORIZED_MANUAL_COST: "verified",
    PURCHASE_ORDER: "provisional",
    VENDOR_QUOTE: "provisional",
    HISTORICAL_APPROVED_COST: "provisional",
    MANUFACTURER_PRICE_LIST: "provisional",
}


def install_default_policy(conn: sqlite3.Connection, policy_key: str) -> int:
    """Seed the evidence-acceptance policy for a calculation policy (idempotent)."""
    n = 0
    for etype, satisfies in DEFAULT_POLICY_MAP.items():
        exists = conn.execute(
            "SELECT 1 FROM cost_evidence_policy WHERE policy_key=? AND evidence_type=?",
            (policy_key, etype)).fetchone()
        if exists:
            continue
        conn.execute(
            """INSERT INTO cost_evidence_policy(id, policy_key, evidence_type, satisfies, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (new_id("evidence_requirement"), policy_key, etype, satisfies, utcnow_iso()))
        n += 1
    return n


def set_acceptance(conn: sqlite3.Connection, policy_key: str, evidence_type: str,
                   satisfies: str) -> None:
    """Configure (or reconfigure) how strongly an evidence type satisfies cost verification."""
    if evidence_type not in ALL_TYPES:
        raise ValueError(f"unknown evidence type {evidence_type!r}")
    if satisfies not in ("verified", "provisional", "rejected"):
        raise ValueError(f"invalid satisfies value {satisfies!r}")
    conn.execute(
        """INSERT INTO cost_evidence_policy(id, policy_key, evidence_type, satisfies, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(policy_key, evidence_type) DO UPDATE SET satisfies=excluded.satisfies""",
        (new_id("evidence_requirement"), policy_key, evidence_type, satisfies, utcnow_iso()))


def record_evidence(
    conn: sqlite3.Connection, *, evidence_type: str, transaction_line_id: str,
    amount: str | Money | None = None, source_reference: str | None = None,
    evidence_date: str | None = None, vendor_id: str | None = None,
    product_id: str | None = None, transaction_id: str | None = None,
    approved_by: str | None = None, expires_on: str | None = None,
) -> str:
    if evidence_type not in ALL_TYPES:
        raise ValueError(f"unknown evidence type {evidence_type!r}")
    amt = None
    if amount is not None:
        amt = (amount if isinstance(amount, Money) else Money.of(amount)).minor
    ev_id = new_id("cost_evidence")
    conn.execute(
        """INSERT INTO cost_evidence(id, evidence_type, source_reference, evidence_date,
           amount_minor, currency, vendor_id, product_id, transaction_id, transaction_line_id,
           approved_by, expires_on, created_at)
           VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?)""",
        (ev_id, evidence_type, source_reference, evidence_date, amt, vendor_id, product_id,
         transaction_id, transaction_line_id, approved_by, expires_on, utcnow_iso()))
    return ev_id


@dataclass
class EvidenceVerdict:
    level: str                 # verified | provisional | unverified
    evidence_type: Optional[str] = None
    reason: str = ""


def evaluate_line(conn: sqlite3.Connection, transaction_line_id: str, policy_key: str,
                  as_of: str | None = None) -> EvidenceVerdict:
    """Strongest acceptance level among the evidence attached to a line.

    Expired evidence does not count. Unknown/rejected types never upgrade a line.
    """
    rows = conn.execute(
        """SELECT e.evidence_type, e.expires_on, COALESCE(p.satisfies,'rejected') AS satisfies
           FROM cost_evidence e
           LEFT JOIN cost_evidence_policy p
             ON p.evidence_type = e.evidence_type AND p.policy_key = ?
           WHERE e.transaction_line_id = ?""", (policy_key, transaction_line_id)).fetchall()
    best = EvidenceVerdict("unverified", None, "no accepted cost evidence on this line")
    rank = {"unverified": 0, "provisional": 1, "verified": 2}
    stamp = as_of or utcnow_iso()
    for r in rows:
        if r["expires_on"] and r["expires_on"] < stamp[:10]:
            continue                                   # expired evidence is ignored
        level = r["satisfies"] if r["satisfies"] in ("verified", "provisional") else "unverified"
        if rank[level] > rank[best.level]:
            best = EvidenceVerdict(level, r["evidence_type"],
                                   f"{r['evidence_type']} satisfies cost at '{level}' under {policy_key}")
    return best
