"""Deterministic financial formula implementations (Correction #4/#5, Section 5/6).

Every function is pure, uses :class:`~finance_system.money.Money` (exact integer
minor units) and :class:`decimal.Decimal`, takes an explicit
:class:`~finance_system.policies.CalculationPolicy`, and documents its formula.

Percentage results are ``Decimal`` or ``None`` when the denominator is zero — callers
must handle ``None`` rather than divide by zero. Margin and markup are distinct and
must not be confused (Section 5).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, localcontext
from typing import Optional

from .money import Money, money_sum
from .policies import CalculationPolicy, FreightTreatment

_PCT_QUANT = Decimal("0.000001")  # internal precision for ratios/percentages


def _pct(numerator: Money, denominator: Money) -> Optional[Decimal]:
    """numerator / denominator * 100, or None if denominator is zero."""
    if denominator.minor == 0:
        return None
    with localcontext() as ctx:
        ctx.prec = 34
        ratio = (Decimal(numerator.minor) / Decimal(denominator.minor)) * Decimal(100)
    return ratio.quantize(_PCT_QUANT)


# --- line level -------------------------------------------------------------

def line_gross_revenue(quantity: Decimal, unit_sales_price: Money) -> Money:
    """Gross Line Revenue = Quantity x Unit Sales Price."""
    return unit_sales_price.multiply(quantity)


def line_net_revenue(
    gross_revenue: Money,
    *,
    discounts: Money,
    credits: Money,
    returns: Money,
    customer_shipping: Money,
    other_authorized_charges: Money,
    policy: CalculationPolicy,
) -> Money:
    """Net Line Revenue = Gross - Discounts - Credits - Returns
    + Customer Shipping Charges + Other Authorized Charges.

    Which subtractions apply is governed by ``policy`` (a treatment, not a guess).
    Tax is excluded unless ``policy.tax_included_in_revenue`` (it is a pass-through).
    """
    net = gross_revenue
    if policy.discounts_reduce_revenue:
        net = net - discounts
    if policy.credits_reduce_revenue:
        net = net - credits
    if policy.returns_reduce_revenue:
        net = net - returns
    if policy.customer_freight_is_revenue:
        net = net + customer_shipping
    net = net + other_authorized_charges
    return net


@dataclass(frozen=True)
class CostComponents:
    """Direct cost components for a line/transaction. Overhead is only included when
    the policy explicitly authorises it."""

    product_cost: Money
    freight_in: Money
    freight_out: Money
    crating: Money
    direct_labor: Money
    outside_services: Money
    installation: Money
    travel: Money
    processing_fees: Money
    tariffs: Money
    other_direct: Money
    allocated_overhead: Money

    @classmethod
    def zero(cls, currency: str = "USD") -> "CostComponents":
        z = Money.zero(currency)
        return cls(z, z, z, z, z, z, z, z, z, z, z, z)


def total_actual_cost(components: CostComponents, policy: CalculationPolicy) -> Money:
    """Total Actual Cost = sum of direct cost components, per policy.

    Freight-in/out and crating are included only when their policy treatment is not
    EXCLUDED. Allocated overhead is included only when policy.include_allocated_overhead.
    """
    parts = [
        components.product_cost,
        components.direct_labor,
        components.outside_services,
        components.installation,
        components.travel,
        components.processing_fees,
        components.tariffs,
        components.other_direct,
    ]
    if policy.freight_in_treatment is not FreightTreatment.EXCLUDED:
        parts.append(components.freight_in)
    if policy.freight_out_treatment is not FreightTreatment.EXCLUDED:
        parts.append(components.freight_out)
    if policy.crating_treatment is not FreightTreatment.EXCLUDED:
        parts.append(components.crating)
    if policy.include_allocated_overhead:
        parts.append(components.allocated_overhead)
    return money_sum(parts, policy.currency)


# --- profitability ----------------------------------------------------------

def gross_profit(net_revenue: Money, total_cost: Money) -> Money:
    """Gross Profit = Net Revenue - Total Actual Cost."""
    return net_revenue - total_cost


def gross_margin_pct(gp: Money, net_revenue: Money) -> Optional[Decimal]:
    """Gross Margin % = Gross Profit / Net Revenue * 100 (None if revenue is 0)."""
    return _pct(gp, net_revenue)


def markup_pct(gp: Money, total_cost: Money) -> Optional[Decimal]:
    """Markup % = Gross Profit / Total Actual Cost * 100 (None if cost is 0).

    NOT the same as margin — different denominator.
    """
    return _pct(gp, total_cost)


def revenue_to_cost_difference(net_revenue: Money, total_cost: Money) -> Money:
    """Revenue-to-Cost Difference = Net Revenue - Total Actual Cost."""
    return net_revenue - total_cost


def unit_actual_cost(total_cost: Money, quantity: Decimal) -> Optional[Money]:
    """Unit Actual Cost = Total Actual Cost / Quantity (None if quantity is 0)."""
    if quantity == 0:
        return None
    with localcontext() as ctx:
        ctx.prec = 34
        per_unit = (Decimal(total_cost.minor) / quantity).to_integral_value()
    return Money.from_minor(int(per_unit), total_cost.currency)


def unit_gross_profit(unit_sales_price: Money, unit_cost: Money) -> Money:
    """Unit Gross Profit = Unit Sales Price - Unit Actual Cost."""
    return unit_sales_price - unit_cost


# --- commission -------------------------------------------------------------

def commission(basis_amount: Money, rate: Decimal) -> Money:
    """Commission = Authorized Commission Basis x Authorized Commission Rate.

    The *basis* (revenue vs gross profit vs collected, ...) is never assumed; callers
    resolve it from a documented rule and pass the resulting ``basis_amount``. A
    missing basis/rate belongs in the exception register, not here.
    """
    return basis_amount.multiply(rate)


def contribution_after_commission(gp: Money, commission_amount: Money) -> Money:
    """Contribution After Commission = Gross Profit - Commission."""
    return gp - commission_amount


# --- weighted monthly totals (Section 6) ------------------------------------

def weighted_gross_margin_pct(total_gp: Money, total_net_revenue: Money) -> Optional[Decimal]:
    """Weighted Gross Margin % = Total Gross Profit / Total Net Revenue * 100.

    This is a weighted figure, never an average of per-line percentages.
    """
    return _pct(total_gp, total_net_revenue)


def weighted_markup_pct(total_gp: Money, total_cost: Money) -> Optional[Decimal]:
    """Weighted Markup % = Total Gross Profit / Total Actual Cost * 100."""
    return _pct(total_gp, total_cost)


@dataclass
class LineResult:
    """Bundle of the line-level calculated values for snapshotting/reporting."""

    gross_revenue: Money
    net_revenue: Money
    total_cost: Money
    gross_profit: Money
    gross_margin_pct: Optional[Decimal]
    markup_pct: Optional[Decimal]
    fields: dict = field(default_factory=dict)


def compute_line(
    *,
    quantity: Decimal,
    unit_sales_price: Money,
    discounts: Money,
    credits: Money,
    returns: Money,
    customer_shipping: Money,
    other_authorized_charges: Money,
    costs: CostComponents,
    policy: CalculationPolicy,
) -> LineResult:
    """Run the full line-level calculation chain under ``policy`` and return results."""
    gross = line_gross_revenue(quantity, unit_sales_price)
    net = line_net_revenue(
        gross,
        discounts=discounts,
        credits=credits,
        returns=returns,
        customer_shipping=customer_shipping,
        other_authorized_charges=other_authorized_charges,
        policy=policy,
    )
    cost = total_actual_cost(costs, policy)
    gp = gross_profit(net, cost)
    return LineResult(
        gross_revenue=gross,
        net_revenue=net,
        total_cost=cost,
        gross_profit=gp,
        gross_margin_pct=gross_margin_pct(gp, net),
        markup_pct=markup_pct(gp, cost),
        fields={
            "revenue_to_cost_difference": revenue_to_cost_difference(net, cost),
        },
    )
