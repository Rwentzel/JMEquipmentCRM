"""Cash application: payments, credits, and returns applied to invoices (Exchange 3).

Closes the reported partial-reconciliation deficiency. This is deliberately NOT a general
ledger: it tracks the money movement needed to distinguish

    invoiced revenue  vs  collected cash  vs  outstanding receivable
    deposit / unapplied payment           vs  applied payment
    earned-commission trigger             vs  paid-commission trigger

Amounts are exact integer minor units; applications are append-only rows in
``payment_applications`` (a reversal is a new negative-effect row, never a mutation).
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Optional

from .db import utcnow_iso
from .ids import new_id
from .money import Money, quantity_from_stored

KIND_PAYMENT = "payment"
KIND_CREDIT = "credit"
KIND_RETURN = "return"
KIND_REVERSAL = "reversal"


class CashApplicationError(ValueError):
    """Raised when an application would violate a cash-application invariant."""


def invoice_total(conn: sqlite3.Connection, invoice_id: str) -> Money:
    """Invoiced amount for a document: sum over ALL its lines (multi-line aware)."""
    total = Money.zero()
    for r in conn.execute(
            """SELECT COALESCE(quantity_minor,0) AS q, COALESCE(unit_sales_price_minor,0) AS p,
                      COALESCE(discount_minor,0) AS d, COALESCE(customer_shipping_minor,0) AS s,
                      COALESCE(customer_crating_minor,0) AS c, COALESCE(other_charges_minor,0) AS o,
                      COALESCE(tax_minor,0) AS tax
               FROM transaction_lines WHERE transaction_id=?""", (invoice_id,)):
        extended = Money.from_minor(r["p"]).multiply(quantity_from_stored(r["q"]))
        total = (total + extended - Money.from_minor(r["d"]) + Money.from_minor(r["s"])
                 + Money.from_minor(r["c"]) + Money.from_minor(r["o"]) + Money.from_minor(r["tax"]))
    return total


def applied_amount(conn: sqlite3.Connection, invoice_id: str) -> Money:
    """Net amount applied to an invoice (reversals already net out)."""
    row = conn.execute(
        "SELECT COALESCE(SUM(amount_minor),0) AS s FROM payment_applications WHERE invoice_transaction_id=?",
        (invoice_id,)).fetchone()
    return Money.from_minor(row["s"])


def invoice_balance(conn: sqlite3.Connection, invoice_id: str) -> Money:
    """Outstanding receivable = invoiced total − net applied."""
    return invoice_total(conn, invoice_id) - applied_amount(conn, invoice_id)


def unapplied_cash(conn: sqlite3.Connection, payment_id: str) -> Money:
    """Payment amount not yet applied to any invoice (deposit / unapplied cash)."""
    received = invoice_total(conn, payment_id)          # payment doc carries its amount on its line
    applied = conn.execute(
        """SELECT COALESCE(SUM(amount_minor),0) AS s FROM payment_applications
           WHERE payment_transaction_id=? AND invoice_transaction_id IS NOT NULL""",
        (payment_id,)).fetchone()["s"]
    return received - Money.from_minor(applied)


def apply_payment(
    conn: sqlite3.Connection, *, payment_id: str, invoice_id: Optional[str], amount: str | Money,
    kind: str = KIND_PAYMENT, allow_overpayment: bool = False, note: str | None = None,
    period_id: str | None = None, batch_id: str | None = None,
) -> str:
    """Apply (part of) a payment/credit/return to an invoice, or record unapplied cash.

    ``invoice_id=None`` records the amount as unapplied cash. Overpayment is refused unless
    explicitly authorized, so cash is never silently over-applied.
    """
    amt = amount if isinstance(amount, Money) else Money.of(amount)
    if amt.minor <= 0:
        raise CashApplicationError("application amount must be positive")
    if invoice_id:
        balance = invoice_balance(conn, invoice_id)
        if amt.minor > balance.minor and not allow_overpayment:
            raise CashApplicationError(
                f"application {amt.rounded()} exceeds outstanding balance {balance.rounded()}; "
                f"authorize overpayment or record it as unapplied cash")
    app_id = new_id("payment_application")
    conn.execute(
        """INSERT INTO payment_applications(id, payment_transaction_id, invoice_transaction_id,
           kind, amount_minor, currency, note, reporting_period_id, import_batch_id, created_at)
           VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?)""",
        (app_id, payment_id, invoice_id, kind, amt.minor, note, period_id, batch_id, utcnow_iso()))
    return app_id


def reverse_application(conn: sqlite3.Connection, application_id: str,
                        note: str | None = None) -> str:
    """Reverse a prior application by appending an offsetting row (never a mutation)."""
    orig = conn.execute("SELECT * FROM payment_applications WHERE id=?", (application_id,)).fetchone()
    if orig is None:
        raise CashApplicationError(f"unknown application {application_id!r}")
    already = conn.execute(
        "SELECT 1 FROM payment_applications WHERE reversed_application_id=? LIMIT 1",
        (application_id,)).fetchone()
    if already:
        raise CashApplicationError("application already reversed")
    rev_id = new_id("payment_application")
    conn.execute(
        """INSERT INTO payment_applications(id, payment_transaction_id, invoice_transaction_id,
           kind, amount_minor, currency, reversed_application_id, note, reporting_period_id,
           import_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (rev_id, orig["payment_transaction_id"], orig["invoice_transaction_id"], KIND_REVERSAL,
         -orig["amount_minor"], orig["currency"], application_id,
         note or f"reversal of {application_id}", orig["reporting_period_id"],
         orig["import_batch_id"], utcnow_iso()))
    return rev_id


@dataclass
class ArStatus:
    invoice_id: str
    invoiced: Money
    applied: Money
    balance: Money
    status: str          # open | partially_paid | paid | overpaid
    external_ref: Optional[str] = None


def ar_status(conn: sqlite3.Connection, invoice_id: str) -> ArStatus:
    invoiced = invoice_total(conn, invoice_id)
    applied = applied_amount(conn, invoice_id)
    balance = invoiced - applied
    if applied.minor == 0:
        status = "open"
    elif balance.minor == 0:
        status = "paid"
    elif balance.minor < 0:
        status = "overpaid"
    else:
        status = "partially_paid"
    ref = conn.execute(
        "SELECT value FROM external_identifiers WHERE entity_id=? AND namespace='invoice_number' LIMIT 1",
        (invoice_id,)).fetchone()
    return ArStatus(invoice_id, invoiced, applied, balance, status, ref["value"] if ref else None)


def cash_bridge(conn: sqlite3.Connection, scope) -> dict:
    """Invoiced revenue -> collected cash -> outstanding receivable, within a report scope."""
    where, params = scope.base_predicate("t")
    invoices = [r[0] for r in conn.execute(
        f"SELECT t.id FROM transactions t WHERE {where} AND t.transaction_type='invoice'", params)]
    payments = [r[0] for r in conn.execute(
        f"SELECT t.id FROM transactions t WHERE {where} AND t.transaction_type='payment'", params)]

    invoiced = Money.zero()
    collected = Money.zero()
    outstanding = Money.zero()
    buckets = {"open": 0, "partially_paid": 0, "paid": 0, "overpaid": 0}
    for inv in invoices:
        st = ar_status(conn, inv)
        invoiced = invoiced + st.invoiced
        collected = collected + st.applied
        outstanding = outstanding + st.balance
        buckets[st.status] += 1
    unapplied = Money.zero()
    for pay in payments:
        unapplied = unapplied + unapplied_cash(conn, pay)
    return {
        "invoiced_revenue": str(invoiced.rounded()),
        "collected_cash_applied": str(collected.rounded()),
        "outstanding_receivable": str(outstanding.rounded()),
        "unapplied_cash_deposits": str(unapplied.rounded()),
        "invoice_status_counts": buckets,
        "note": ("invoiced revenue is recognized revenue; collected cash is applied money; "
                 "they are never conflated"),
    }
