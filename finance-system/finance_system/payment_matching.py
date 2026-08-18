"""Payment-to-invoice match proposals (Exchange 3).

Closes the "no automatic payment matching" gap WITHOUT violating the system's rule that
money is never moved silently: this module *proposes* explainable matches and an operator
approves them. Nothing is applied automatically.

Signals are explicit and reported per candidate, mirroring duplicate detection:
referenced invoice number, same customer, exact amount match, amount within the open
balance, and date proximity.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional

from . import cash
from .money import Money

# A candidate must clear this score to be proposed at all.
MIN_SCORE = Decimal("0.45")


@dataclass
class MatchCandidate:
    payment_id: str
    invoice_id: str
    invoice_ref: Optional[str]
    unapplied: str
    invoice_balance: str
    suggested_amount: str
    score: str
    matching_signals: list = field(default_factory=list)
    conflicting_signals: list = field(default_factory=list)
    recommended_disposition: str = "review"

    def to_dict(self) -> dict:
        return {
            "payment_id": self.payment_id, "invoice_id": self.invoice_id,
            "invoice_ref": self.invoice_ref, "unapplied": self.unapplied,
            "invoice_balance": self.invoice_balance, "suggested_amount": self.suggested_amount,
            "score": self.score, "matching_signals": self.matching_signals,
            "conflicting_signals": self.conflicting_signals,
            "recommended_disposition": self.recommended_disposition,
        }


def _ref(conn, txn_id, namespace="invoice_number") -> Optional[str]:
    r = conn.execute(
        "SELECT value FROM external_identifiers WHERE entity_id=? AND namespace=? LIMIT 1",
        (txn_id, namespace)).fetchone()
    return r["value"] if r else None


def _days_apart(a: Optional[str], b: Optional[str]) -> Optional[int]:
    if not a or not b:
        return None
    try:
        return abs((date.fromisoformat(a) - date.fromisoformat(b)).days)
    except ValueError:
        return None


def propose_matches(conn: sqlite3.Connection, scope, max_per_payment: int = 5) -> list:
    """Propose payment -> invoice applications within a report scope. Applies nothing."""
    where, params = scope.base_predicate("t")
    payments = conn.execute(
        f"""SELECT t.* FROM transactions t WHERE {where} AND t.transaction_type='payment'""",
        params).fetchall()
    invoices = conn.execute(
        f"""SELECT t.* FROM transactions t WHERE {where} AND t.transaction_type='invoice'""",
        params).fetchall()

    open_invoices = []
    for inv in invoices:
        bal = cash.invoice_balance(conn, inv["id"])
        if bal.minor > 0:
            open_invoices.append((inv, bal))

    out: list[MatchCandidate] = []
    for pay in payments:
        remaining = cash.unapplied_cash(conn, pay["id"])
        if remaining.minor <= 0:
            continue
        pay_ref = _ref(conn, pay["id"])
        candidates: list[MatchCandidate] = []
        for inv, bal in open_invoices:
            matching, conflicting = [], []
            inv_ref = _ref(conn, inv["id"])

            if pay_ref and inv_ref and pay_ref == inv_ref:
                matching.append("payment references this invoice number")
            elif pay_ref and inv_ref:
                conflicting.append("payment references a different invoice number")

            if pay["customer_id"] and inv["customer_id"]:
                if pay["customer_id"] == inv["customer_id"]:
                    matching.append("same customer")
                else:
                    conflicting.append("different customer")

            if remaining.minor == bal.minor:
                matching.append("amount exactly settles the invoice")
            elif remaining.minor <= bal.minor:
                matching.append("amount fits within the open balance")
            else:
                conflicting.append("amount exceeds the open balance")

            days = _days_apart(pay["payment_date"] or pay["transaction_date"],
                               inv["invoice_date"] or inv["transaction_date"])
            if days is not None:
                if days <= 45:
                    matching.append(f"dated {days} day(s) apart")
                else:
                    conflicting.append(f"dated {days} day(s) apart")

            considered = len(matching) + len(conflicting)
            if not considered:
                continue
            score = Decimal(len(matching)) / Decimal(considered)
            # A different customer is disqualifying regardless of other signals.
            if "different customer" in conflicting or score < MIN_SCORE:
                continue
            suggested = Money.from_minor(min(remaining.minor, bal.minor))
            disposition = ("apply in full — exact match" if
                           "payment references this invoice number" in matching
                           and "amount exactly settles the invoice" in matching
                           else "review — partial or inferred match")
            candidates.append(MatchCandidate(
                pay["id"], inv["id"], inv_ref, str(remaining.rounded()), str(bal.rounded()),
                str(suggested.rounded()), format(score, "f"), matching, conflicting, disposition))
        candidates.sort(key=lambda c: Decimal(c.score), reverse=True)
        out.extend(candidates[:max_per_payment])
    return out


def apply_proposal(conn: sqlite3.Connection, candidate: MatchCandidate | dict,
                   *, approved_by: str, amount: str | None = None) -> str:
    """Apply an operator-APPROVED proposal. Requires an approver; never called implicitly."""
    c = candidate if isinstance(candidate, dict) else candidate.to_dict()
    if not approved_by or not approved_by.strip():
        raise cash.CashApplicationError(
            "applying a proposed match requires an approver — matches are never auto-applied")
    return cash.apply_payment(
        conn, payment_id=c["payment_id"], invoice_id=c["invoice_id"],
        amount=amount or c["suggested_amount"],
        note=f"approved match ({c['score']}) by {approved_by.strip()}")
