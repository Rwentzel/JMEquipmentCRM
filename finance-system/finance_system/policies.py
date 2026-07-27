"""Calculation-policy layer (Correction #4).

Formulas must not assume one universal treatment. A :class:`CalculationPolicy` is a
named, **versioned**, immutable bundle of choices (revenue/cost recognition basis,
freight treatment, discount/return/credit handling, rounding, commission basis and
eligibility, currency precision, reporting-period assignment). Calculations record
the policy version they used; historical results are never silently recomputed under
a new policy (Correction #4).
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from enum import Enum
from decimal import ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_DOWN


class RevenueBasis(str, Enum):
    INVOICED = "invoiced"
    SHIPPED = "shipped"
    COLLECTED = "collected"
    ORDERED = "ordered"


class CostBasis(str, Enum):
    ACTUAL_VENDOR_BILL = "actual_vendor_bill"
    PO_ESTIMATE = "po_estimate"
    STANDARD = "standard"


class FreightTreatment(str, Enum):
    # Freight-in as part of COGS; freight-out as a direct selling cost.
    COGS = "cogs"
    DIRECT_COST = "direct_cost"
    EXCLUDED = "excluded"


class CommissionBasis(str, Enum):
    # NEVER assumed. If a rule does not state one, commission goes to exceptions.
    REVENUE = "revenue"
    GROSS_PROFIT = "gross_profit"
    COLLECTED_REVENUE = "collected_revenue"
    INVOICED_REVENUE = "invoiced_revenue"
    SHIPPED_REVENUE = "shipped_revenue"


class CommissionEligibility(str, Enum):
    ON_INVOICE = "on_invoice"
    ON_SHIPMENT = "on_shipment"
    ON_PAYMENT = "on_payment"


class RoundingMethod(str, Enum):
    HALF_UP = "half_up"
    HALF_EVEN = "half_even"
    DOWN = "down"

    def to_decimal_rounding(self) -> str:
        return {
            RoundingMethod.HALF_UP: ROUND_HALF_UP,
            RoundingMethod.HALF_EVEN: ROUND_HALF_EVEN,
            RoundingMethod.DOWN: ROUND_DOWN,
        }[self]


@dataclass(frozen=True)
class CalculationPolicy:
    """An immutable, versioned set of financial-treatment choices."""

    name: str
    version: int

    revenue_basis: RevenueBasis = RevenueBasis.INVOICED
    cost_basis: CostBasis = CostBasis.ACTUAL_VENDOR_BILL

    freight_in_treatment: FreightTreatment = FreightTreatment.COGS
    freight_out_treatment: FreightTreatment = FreightTreatment.DIRECT_COST
    crating_treatment: FreightTreatment = FreightTreatment.DIRECT_COST

    # Customer freight/crating charged on the invoice is revenue when True.
    customer_freight_is_revenue: bool = True
    customer_crating_is_revenue: bool = True

    # Net-revenue composition.
    discounts_reduce_revenue: bool = True
    returns_reduce_revenue: bool = True
    credits_reduce_revenue: bool = True
    tax_included_in_revenue: bool = False  # tax is a pass-through, excluded by default

    # Overhead is only ever included when explicitly authorised.
    include_allocated_overhead: bool = False

    commission_basis: CommissionBasis | None = None  # None => must be resolved per rule
    commission_eligibility: CommissionEligibility = CommissionEligibility.ON_INVOICE

    rounding: RoundingMethod = RoundingMethod.HALF_UP
    currency: str = "USD"

    # How a transaction is assigned to a reporting period.
    period_assignment_field: str = "invoice_date"

    def key(self) -> str:
        return f"{self.name}@v{self.version}"

    def to_dict(self) -> dict:
        d = asdict(self)
        # Enums -> their string values for stable JSON snapshotting.
        for k, v in list(d.items()):
            if isinstance(v, Enum):
                d[k] = v.value
        return d


# The seed default policy for JM Equipment. Bump ``version`` (never mutate in place)
# to change treatment; old snapshots keep pointing at the version they used.
DEFAULT_POLICY = CalculationPolicy(
    name="jm-default",
    version=1,
    commission_basis=None,  # deliberately unset: commission basis is never assumed
)
