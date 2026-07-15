"""Separated operational totals (Correction #9).

Every headline figure is split into five reconciling buckets — Verified, Provisional,
Exception-excluded, Estimated, Forecast — and the buckets sum to a grand total via an
explicit reconciliation bridge. No single blended number is produced without that
breakdown. Estimated/Forecast are structurally present but empty in Exchange 1 (their
producers arrive in later exchanges).

Revenue and gross profit are bucketed independently by their *own* calculation-level
verification (Correction #5): a line can be verified for revenue yet unverified for
gross profit, landing its revenue in Verified and its gross profit in Exception.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from .formulas import CostComponents, compute_line, weighted_gross_margin_pct
from .models import CostComponentType
from .money import Money, money_sum, quantity_from_stored
from .policies import CalculationPolicy
from .verification import CalculationType, VerificationLevel

_BUCKETS = ("verified", "provisional", "exception", "estimated", "forecast")


@dataclass
class Bucketed:
    """A metric split across the five reconciling buckets."""

    currency: str = "USD"
    amounts: dict[str, Money] = field(default_factory=dict)
    counts: dict[str, int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for b in _BUCKETS:
            self.amounts.setdefault(b, Money.zero(self.currency))
            self.counts.setdefault(b, 0)

    def add(self, bucket: str, amount: Money) -> None:
        self.amounts[bucket] = self.amounts[bucket] + amount
        self.counts[bucket] += 1

    def grand_total(self) -> Money:
        return money_sum([self.amounts[b] for b in _BUCKETS], self.currency)

    def to_dict(self) -> dict:
        return {
            "by_bucket": {b: str(self.amounts[b].rounded()) for b in _BUCKETS},
            "counts": dict(self.counts),
            "grand_total": str(self.grand_total().rounded()),
        }


@dataclass
class ReportTotals:
    currency: str = "USD"
    net_revenue: Bucketed = field(default_factory=lambda: Bucketed())
    total_cost: Bucketed = field(default_factory=lambda: Bucketed())
    gross_profit: Bucketed = field(default_factory=lambda: Bucketed())
    lines_considered: int = 0

    def weighted_verified_margin_pct(self) -> Optional[Decimal]:
        return weighted_gross_margin_pct(
            self.gross_profit.amounts["verified"], self.net_revenue.amounts["verified"]
        )

    def reconciliation_bridge(self) -> dict:
        """Show that buckets reconcile to the grand total for each metric."""
        out = {}
        for name, metric in (("net_revenue", self.net_revenue),
                             ("total_cost", self.total_cost),
                             ("gross_profit", self.gross_profit)):
            out[name] = {
                "verified": str(metric.amounts["verified"].rounded()),
                "provisional": str(metric.amounts["provisional"].rounded()),
                "exception_excluded": str(metric.amounts["exception"].rounded()),
                "estimated": str(metric.amounts["estimated"].rounded()),
                "forecast": str(metric.amounts["forecast"].rounded()),
                "grand_total": str(metric.grand_total().rounded()),
            }
        return out

    def to_dict(self) -> dict:
        m = self.weighted_verified_margin_pct()
        return {
            "currency": self.currency,
            "lines_considered": self.lines_considered,
            "net_revenue": self.net_revenue.to_dict(),
            "total_cost": self.total_cost.to_dict(),
            "gross_profit": self.gross_profit.to_dict(),
            "weighted_verified_gross_margin_pct": (str(m) if m is not None else None),
            "reconciliation_bridge": self.reconciliation_bridge(),
        }


def _bucket_for(level: VerificationLevel) -> str:
    return {
        VerificationLevel.VERIFIED: "verified",
        VerificationLevel.PROVISIONAL: "provisional",
        VerificationLevel.UNVERIFIED: "exception",
    }[level]


def _line_costs(conn: sqlite3.Connection, line_id: str, currency: str) -> CostComponents:
    rows = conn.execute(
        "SELECT component_type, amount_minor, currency FROM cost_components WHERE transaction_line_id = ?",
        (line_id,),
    ).fetchall()
    by_type = {t: Money.zero(currency) for t in CostComponentType}
    for r in rows:
        ct = CostComponentType(r["component_type"])
        by_type[ct] = by_type[ct] + Money.from_minor(r["amount_minor"], r["currency"])
    return CostComponents(
        product_cost=by_type[CostComponentType.PRODUCT_COST],
        freight_in=by_type[CostComponentType.FREIGHT_IN],
        freight_out=by_type[CostComponentType.FREIGHT_OUT],
        crating=by_type[CostComponentType.CRATING],
        direct_labor=by_type[CostComponentType.DIRECT_LABOR],
        outside_services=by_type[CostComponentType.OUTSIDE_SERVICES],
        installation=by_type[CostComponentType.INSTALLATION],
        travel=by_type[CostComponentType.TRAVEL],
        processing_fees=by_type[CostComponentType.PROCESSING_FEES],
        tariffs=by_type[CostComponentType.TARIFFS],
        other_direct=by_type[CostComponentType.OTHER_DIRECT],
        allocated_overhead=by_type[CostComponentType.ALLOCATED_OVERHEAD],
    )


def _line_level(conn: sqlite3.Connection, line_id: str, txn_id: str,
                calc: CalculationType) -> VerificationLevel:
    """Line-scoped verification if present, else transaction-scoped, else UNVERIFIED."""
    row = conn.execute(
        """SELECT level FROM record_verifications
           WHERE calculation_type = ? AND (transaction_line_id = ? OR
                 (transaction_line_id IS NULL AND transaction_id = ?))
           ORDER BY (transaction_line_id IS NULL) LIMIT 1""",
        (calc.value, line_id, txn_id),
    ).fetchone()
    return VerificationLevel(row["level"]) if row else VerificationLevel.UNVERIFIED


def compute_separated_totals(
    conn: sqlite3.Connection, policy: CalculationPolicy
) -> ReportTotals:
    """Compute Verified/Provisional/Exception separated totals over POSTED sale lines."""
    currency = policy.currency
    totals = ReportTotals(currency=currency)
    lines = conn.execute(
        """SELECT l.*, t.id AS txn_id FROM transaction_lines l
           JOIN transactions t ON t.id = l.transaction_id
           WHERE t.posted = 1""",
    ).fetchall()
    for l in lines:
        totals.lines_considered += 1
        qty = quantity_from_stored(l["quantity_minor"] or 0)
        unit_price = Money.from_minor(l["unit_sales_price_minor"] or 0, currency)
        result = compute_line(
            quantity=qty,
            unit_sales_price=unit_price,
            discounts=Money.from_minor(l["discount_minor"], currency),
            credits=Money.from_minor(l["credit_minor"], currency),
            returns=Money.from_minor(l["return_minor"], currency),
            customer_shipping=Money.from_minor(l["customer_shipping_minor"], currency),
            other_authorized_charges=Money.from_minor(l["other_charges_minor"], currency),
            costs=_line_costs(conn, l["id"], currency),
            policy=policy,
        )
        rev_level = _line_level(conn, l["id"], l["txn_id"], CalculationType.REVENUE)
        gp_level = _line_level(conn, l["id"], l["txn_id"], CalculationType.GROSS_PROFIT)
        cost_level = _line_level(conn, l["id"], l["txn_id"], CalculationType.COST)
        totals.net_revenue.add(_bucket_for(rev_level), result.net_revenue)
        totals.total_cost.add(_bucket_for(cost_level), result.total_cost)
        totals.gross_profit.add(_bucket_for(gp_level), result.gross_profit)
    return totals
