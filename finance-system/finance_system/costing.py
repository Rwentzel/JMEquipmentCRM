"""Shared cost-component loading used by posting and reporting."""

from __future__ import annotations

import sqlite3

from .formulas import CostComponents
from .models import CostComponentType
from .money import Money


def load_cost_map(conn: sqlite3.Connection, line_id: str, currency: str) -> dict[CostComponentType, Money]:
    rows = conn.execute(
        "SELECT component_type, amount_minor, currency FROM cost_components WHERE transaction_line_id = ?",
        (line_id,),
    ).fetchall()
    by_type = {t: Money.zero(currency) for t in CostComponentType}
    for r in rows:
        ct = CostComponentType(r["component_type"])
        by_type[ct] = by_type[ct] + Money.from_minor(r["amount_minor"], r["currency"])
    return by_type


def cost_components(conn: sqlite3.Connection, line_id: str, currency: str) -> CostComponents:
    m = load_cost_map(conn, line_id, currency)
    return CostComponents(
        product_cost=m[CostComponentType.PRODUCT_COST],
        freight_in=m[CostComponentType.FREIGHT_IN],
        freight_out=m[CostComponentType.FREIGHT_OUT],
        crating=m[CostComponentType.CRATING],
        direct_labor=m[CostComponentType.DIRECT_LABOR],
        outside_services=m[CostComponentType.OUTSIDE_SERVICES],
        installation=m[CostComponentType.INSTALLATION],
        travel=m[CostComponentType.TRAVEL],
        processing_fees=m[CostComponentType.PROCESSING_FEES],
        tariffs=m[CostComponentType.TARIFFS],
        other_direct=m[CostComponentType.OTHER_DIRECT],
        allocated_overhead=m[CostComponentType.ALLOCATED_OVERHEAD],
    )
