"""Separated operational totals + profitability-verified populations.

Correction #9 / Exchange 1: every headline figure is split into five reconciling buckets
— Verified, Provisional, Exception-excluded, Estimated, Forecast — that sum to a grand
total via an explicit bridge. No single blended number.

Defect 2 (Exchange 2): verified **margin** and **markup** must NOT be computed from all
revenue-verified lines. Three distinct populations are maintained:

  * Revenue-verified   — lines whose recognized revenue is verified.
  * Cost-verified      — lines whose relevant actual cost is verified.
  * Profitability-verified — lines where BOTH revenue and cost are verified under the same
    policy/basis. Only this population feeds verified margin/markup denominators.

Revenue verified without verified cost still appears in verified revenue totals but is
excluded from verified profitability, with a reconciliation bridge explaining the gap.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from .formulas import compute_line, weighted_gross_margin_pct, weighted_markup_pct
from .money import Money, money_sum, quantity_from_stored
from .policies import CalculationPolicy
from .verification import CalculationType, VerificationLevel

_BUCKETS = ("verified", "provisional", "exception", "estimated", "forecast")


@dataclass
class Bucketed:
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
class ProfitabilityPopulations:
    """The Defect-2 eligibility sets and the verified margin/markup derived from them."""

    currency: str = "USD"
    revenue_verified_net_revenue: Money = field(default_factory=Money.zero)
    cost_verified_total_cost: Money = field(default_factory=Money.zero)
    prof_net_revenue: Money = field(default_factory=Money.zero)
    prof_total_cost: Money = field(default_factory=Money.zero)
    prof_gross_profit: Money = field(default_factory=Money.zero)
    excluded_net_revenue: Money = field(default_factory=Money.zero)
    cost_awaiting_proof: Money = field(default_factory=Money.zero)
    gross_profit_excluded: Money = field(default_factory=Money.zero)
    exclusions: list[dict] = field(default_factory=list)
    prof_line_count: int = 0

    def verified_gross_margin_pct(self) -> Optional[Decimal]:
        return weighted_gross_margin_pct(self.prof_gross_profit, self.prof_net_revenue)

    def verified_markup_pct(self) -> Optional[Decimal]:
        return weighted_markup_pct(self.prof_gross_profit, self.prof_total_cost)

    def bridge(self) -> dict:
        m = self.verified_gross_margin_pct()
        return {
            "total_revenue_verified_net_revenue": str(self.revenue_verified_net_revenue.rounded()),
            "net_revenue_eligible_for_verified_profitability": str(self.prof_net_revenue.rounded()),
            "revenue_excluded_from_verified_profitability": str(self.excluded_net_revenue.rounded()),
            "cost_awaiting_proof": str(self.cost_awaiting_proof.rounded()),
            "gross_profit_excluded_from_verified_totals": str(self.gross_profit_excluded.rounded()),
            "profitability_verified_gross_profit": str(self.prof_gross_profit.rounded()),
            "verified_gross_margin_pct": (str(m) if m is not None else None),
            "verified_markup_pct": (str(self.verified_markup_pct())
                                    if self.verified_markup_pct() is not None else None),
            "exclusion_reasons": self.exclusions,
        }


@dataclass
class ReportTotals:
    currency: str = "USD"
    net_revenue: Bucketed = field(default_factory=lambda: Bucketed())
    total_cost: Bucketed = field(default_factory=lambda: Bucketed())
    gross_profit: Bucketed = field(default_factory=lambda: Bucketed())
    populations: ProfitabilityPopulations = field(default_factory=ProfitabilityPopulations)
    lines_considered: int = 0

    def reconciliation_bridge(self) -> dict:
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
        return {
            "currency": self.currency,
            "lines_considered": self.lines_considered,
            "net_revenue": self.net_revenue.to_dict(),
            "total_cost": self.total_cost.to_dict(),
            "gross_profit": self.gross_profit.to_dict(),
            "profitability_populations": self.populations.bridge(),
            # Verified margin/markup come ONLY from the profitability-verified population.
            "verified_gross_margin_pct": self.populations.bridge()["verified_gross_margin_pct"],
            "verified_markup_pct": self.populations.bridge()["verified_markup_pct"],
            "reconciliation_bridge": self.reconciliation_bridge(),
        }


def _bucket_for(level: VerificationLevel) -> str:
    return {
        VerificationLevel.VERIFIED: "verified",
        VerificationLevel.PROVISIONAL: "provisional",
        VerificationLevel.UNVERIFIED: "exception",
    }[level]


def _line_level(conn: sqlite3.Connection, line_id: str, txn_id: str,
                calc: CalculationType) -> VerificationLevel:
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
    """Compute separated totals + profitability populations over POSTED sale lines."""
    from .costing import cost_components  # local import avoids cycle

    currency = policy.currency
    totals = ReportTotals(currency=currency)
    pop = totals.populations
    pop.currency = currency
    # Only revenue-bearing sale documents feed revenue/cost/GP totals — sales orders,
    # quotes, payments, POs, etc. are stored and posted but are not revenue.
    lines = conn.execute(
        """SELECT l.*, t.id AS txn_id FROM transaction_lines l
           JOIN transactions t ON t.id = l.transaction_id
           WHERE t.posted = 1 AND t.transaction_type IN ('invoice','credit_memo','return')""",
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
            costs=cost_components(conn, l["id"], currency),
            policy=policy,
        )
        rev_level = _line_level(conn, l["id"], l["txn_id"], CalculationType.REVENUE)
        cost_level = _line_level(conn, l["id"], l["txn_id"], CalculationType.COST)
        gp_level = _line_level(conn, l["id"], l["txn_id"], CalculationType.GROSS_PROFIT)

        totals.net_revenue.add(_bucket_for(rev_level), result.net_revenue)
        totals.total_cost.add(_bucket_for(cost_level), result.total_cost)
        totals.gross_profit.add(_bucket_for(gp_level), result.gross_profit)

        rev_ok = rev_level is VerificationLevel.VERIFIED
        cost_ok = cost_level is VerificationLevel.VERIFIED
        if rev_ok:
            pop.revenue_verified_net_revenue = pop.revenue_verified_net_revenue + result.net_revenue
        if cost_ok:
            pop.cost_verified_total_cost = pop.cost_verified_total_cost + result.total_cost
        if rev_ok and cost_ok:
            # Profitability-verified: BOTH sides verified under the same policy.
            pop.prof_net_revenue = pop.prof_net_revenue + result.net_revenue
            pop.prof_total_cost = pop.prof_total_cost + result.total_cost
            pop.prof_gross_profit = pop.prof_gross_profit + result.gross_profit
            pop.prof_line_count += 1
        elif rev_ok and not cost_ok:
            # Revenue verified but cost unverified: excluded from verified profitability.
            pop.excluded_net_revenue = pop.excluded_net_revenue + result.net_revenue
            pop.cost_awaiting_proof = pop.cost_awaiting_proof + result.total_cost
            pop.gross_profit_excluded = pop.gross_profit_excluded + result.gross_profit
            pop.exclusions.append({
                "transaction_line_id": l["id"],
                "reason": f"cost verification is '{cost_level.value}', not verified",
                "revenue_excluded": str(result.net_revenue.rounded()),
                "unverified_cost_present": str(result.total_cost.rounded()),
            })
    return totals
