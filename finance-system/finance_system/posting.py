"""Transactional posting with calculation-snapshot persistence (Defect 1).

Posting a batch computes every material line-level result and writes an immutable
:mod:`finance_system.snapshots` row for each, links a commission calculation when an
authorized rule is present, marks the transactions posted, and records an audit event —
all inside one DB transaction so a failure posts nothing (no partial posting).

Recalculation after evidence resolution calls :func:`persist_line_snapshots` with
``supersede=True``: new snapshots are appended pointing at the prior ones; originals are
never overwritten.
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal
from typing import Optional

from . import audit, snapshots
from .costing import cost_components, load_cost_map
from .db import utcnow_iso
from .formulas import (
    commission as f_commission, compute_line, contribution_after_commission,
    gross_margin_pct, markup_pct, unit_actual_cost, unit_gross_profit,
)
from .ids import new_id
from .imports import _period_locked_for, batch_status
from .models import CostComponentType, ImportBatchStatus
from .money import Money, quantity_from_stored
from .policies import CalculationPolicy, CommissionBasis
from .verification import CalculationType, VerificationLevel


def _level(conn, line_id, txn_id, calc: CalculationType) -> VerificationLevel:
    row = conn.execute(
        """SELECT level FROM record_verifications
           WHERE calculation_type = ? AND (transaction_line_id = ? OR
                 (transaction_line_id IS NULL AND transaction_id = ?))
           ORDER BY (transaction_line_id IS NULL) LIMIT 1""",
        (calc.value, line_id, txn_id),
    ).fetchone()
    return VerificationLevel(row["level"]) if row else VerificationLevel.UNVERIFIED


def _snap(conn, name, entity_id, inputs, out_value, out_kind, level, policy,
          *, txn_id, line_id, period_id, batch_id, scale, supersede_of=None):
    return snapshots.persist_snapshot(
        conn, calculation_name=name, entity_type="transaction_line", entity_id=entity_id,
        inputs=inputs, output_value=out_value, output_kind=out_kind,
        verification_state=level.value, policy=policy, reporting_period_id=period_id,
        import_batch_id=batch_id, source_transaction_id=txn_id, source_line_id=line_id,
        evidence_basis=f"policy={policy.key()}", output_scale=scale,
        superseded_snapshot_id=supersede_of,
    )


def _basis_amount(basis: str, net_revenue: Money, gross_profit: Money) -> Optional[Money]:
    if basis in (CommissionBasis.GROSS_PROFIT.value,):
        return gross_profit
    if basis in (CommissionBasis.REVENUE.value, CommissionBasis.INVOICED_REVENUE.value,
                 CommissionBasis.SHIPPED_REVENUE.value, CommissionBasis.COLLECTED_REVENUE.value):
        return net_revenue
    return None


def persist_line_snapshots(
    conn: sqlite3.Connection, txn: sqlite3.Row, line: sqlite3.Row,
    policy: CalculationPolicy, *, supersede: bool = False,
) -> int:
    """Compute + persist all material snapshots for one line. Returns snapshot count."""
    currency = policy.currency
    line_id, txn_id = line["id"], txn["id"]
    period_id, batch_id = txn["reporting_period_id"], txn["import_batch_id"]
    qty = quantity_from_stored(line["quantity_minor"] or 0)
    unit_price = Money.from_minor(line["unit_sales_price_minor"] or 0, currency)
    discounts = Money.from_minor(line["discount_minor"], currency)
    credits = Money.from_minor(line["credit_minor"], currency)
    returns = Money.from_minor(line["return_minor"], currency)
    shipping = Money.from_minor(line["customer_shipping_minor"], currency)
    other = Money.from_minor(line["other_charges_minor"], currency)
    costs = cost_components(conn, line_id, currency)
    cost_map = load_cost_map(conn, line_id, currency)

    result = compute_line(
        quantity=qty, unit_sales_price=unit_price, discounts=discounts, credits=credits,
        returns=returns, customer_shipping=shipping, other_authorized_charges=other,
        costs=costs, policy=policy)

    rev_lvl = _level(conn, line_id, txn_id, CalculationType.REVENUE)
    cost_lvl = _level(conn, line_id, txn_id, CalculationType.COST)
    gp_lvl = _level(conn, line_id, txn_id, CalculationType.GROSS_PROFIT)
    comm_lvl = _level(conn, line_id, txn_id, CalculationType.COMMISSION)

    def sup(name):
        if not supersede:
            return None
        prev = snapshots.latest(conn, "transaction_line", line_id, name)
        return prev["id"] if prev else None

    gross = unit_price.multiply(qty)
    product_cost = cost_map[CostComponentType.PRODUCT_COST]
    ucost = unit_actual_cost(result.total_cost, qty)
    ugp = unit_gross_profit(unit_price, ucost) if ucost is not None else None
    freight_recovery = shipping - cost_map[CostComponentType.FREIGHT_OUT]
    crating_recovery = Money.zero(currency) - cost_map[CostComponentType.CRATING]
    gm = gross_margin_pct(result.gross_profit, result.net_revenue)
    mk = markup_pct(result.gross_profit, result.total_cost)

    n = 0
    # revenue family
    _snap(conn, snapshots.CALC_GROSS_LINE_REVENUE, line_id,
          {"quantity": qty, "unit_sales_price": unit_price}, str(gross.minor), "money_minor",
          rev_lvl, policy, txn_id=txn_id, line_id=line_id, period_id=period_id,
          batch_id=batch_id, scale=4, supersede_of=sup(snapshots.CALC_GROSS_LINE_REVENUE)); n += 1
    _snap(conn, snapshots.CALC_NET_LINE_REVENUE, line_id,
          {"gross": gross, "discounts": discounts, "credits": credits, "returns": returns,
           "customer_shipping": shipping, "other": other}, str(result.net_revenue.minor),
          "money_minor", rev_lvl, policy, txn_id=txn_id, line_id=line_id, period_id=period_id,
          batch_id=batch_id, scale=4, supersede_of=sup(snapshots.CALC_NET_LINE_REVENUE)); n += 1
    _snap(conn, snapshots.CALC_RECOGNIZED_REVENUE, line_id,
          {"net_revenue": result.net_revenue, "basis": policy.revenue_basis.value},
          str(result.net_revenue.minor), "money_minor", rev_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_RECOGNIZED_REVENUE)); n += 1
    # cost family
    _snap(conn, snapshots.CALC_PRODUCT_COST, line_id, {"product_cost": product_cost},
          str(product_cost.minor), "money_minor", cost_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_PRODUCT_COST)); n += 1
    _snap(conn, snapshots.CALC_TOTAL_ACTUAL_COST, line_id, {"components": "see cost_components"},
          str(result.total_cost.minor), "money_minor", cost_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_TOTAL_ACTUAL_COST)); n += 1
    _snap(conn, snapshots.CALC_UNIT_COST, line_id, {"total_cost": result.total_cost, "quantity": qty},
          (str(ucost.minor) if ucost is not None else "null"),
          ("money_minor" if ucost is not None else "none"), cost_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_UNIT_COST)); n += 1
    # profitability family (verification = gross_profit level)
    _snap(conn, snapshots.CALC_GROSS_PROFIT, line_id,
          {"net_revenue": result.net_revenue, "total_cost": result.total_cost},
          str(result.gross_profit.minor), "money_minor", gp_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_GROSS_PROFIT)); n += 1
    _snap(conn, snapshots.CALC_GROSS_MARGIN, line_id,
          {"gross_profit": result.gross_profit, "net_revenue": result.net_revenue},
          (str(gm) if gm is not None else "null"), ("percent" if gm is not None else "none"),
          gp_lvl, policy, txn_id=txn_id, line_id=line_id, period_id=period_id, batch_id=batch_id,
          scale=None, supersede_of=sup(snapshots.CALC_GROSS_MARGIN)); n += 1
    _snap(conn, snapshots.CALC_MARKUP, line_id,
          {"gross_profit": result.gross_profit, "total_cost": result.total_cost},
          (str(mk) if mk is not None else "null"), ("percent" if mk is not None else "none"),
          gp_lvl, policy, txn_id=txn_id, line_id=line_id, period_id=period_id, batch_id=batch_id,
          scale=None, supersede_of=sup(snapshots.CALC_MARKUP)); n += 1
    _snap(conn, snapshots.CALC_UNIT_GROSS_PROFIT, line_id,
          {"unit_sales_price": unit_price, "unit_cost": ucost},
          (str(ugp.minor) if ugp is not None else "null"),
          ("money_minor" if ugp is not None else "none"), gp_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_UNIT_GROSS_PROFIT)); n += 1
    _snap(conn, snapshots.CALC_FREIGHT_RECOVERY, line_id,
          {"customer_shipping": shipping, "freight_out": cost_map[CostComponentType.FREIGHT_OUT]},
          str(freight_recovery.minor), "money_minor", cost_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_FREIGHT_RECOVERY)); n += 1
    _snap(conn, snapshots.CALC_CRATING_RECOVERY, line_id,
          {"crating_cost": cost_map[CostComponentType.CRATING]},
          str(crating_recovery.minor), "money_minor", cost_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_CRATING_RECOVERY)); n += 1

    # commission family (only when an authorized rule is present and verified)
    rule_id = txn["commission_rule_id"] if "commission_rule_id" in txn.keys() else None
    if rule_id:
        rule = conn.execute("SELECT * FROM commission_rules WHERE id = ?", (rule_id,)).fetchone()
    else:
        rule = None
    basis_amt = None
    commission_amt = None
    if rule and rule["basis"] and rule["rate_canonical"] and comm_lvl is VerificationLevel.VERIFIED:
        basis_amt = _basis_amount(rule["basis"], result.net_revenue, result.gross_profit)
        if basis_amt is not None:
            rate = Decimal(rule["rate_canonical"])
            commission_amt = f_commission(basis_amt, rate)
    _snap(conn, snapshots.CALC_COMMISSION_BASIS, line_id,
          {"rule_basis": (rule["basis"] if rule else None)},
          (str(basis_amt.minor) if basis_amt is not None else "null"),
          ("money_minor" if basis_amt is not None else "none"), comm_lvl, policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_COMMISSION_BASIS)); n += 1
    _snap(conn, snapshots.CALC_COMMISSION_AMOUNT, line_id,
          {"basis_amount": basis_amt, "rate": (rule["rate_canonical"] if rule else None)},
          (str(commission_amt.minor) if commission_amt is not None else "null"),
          ("money_minor" if commission_amt is not None else "none"), comm_lvl, policy,
          txn_id=txn_id, line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_COMMISSION_AMOUNT)); n += 1
    contribution = (result.gross_profit - commission_amt) if commission_amt is not None else result.gross_profit
    _snap(conn, snapshots.CALC_CONTRIBUTION_AFTER_COMMISSION, line_id,
          {"gross_profit": result.gross_profit, "commission": commission_amt},
          str(contribution.minor), "money_minor",
          (comm_lvl if commission_amt is not None else gp_lvl), policy, txn_id=txn_id,
          line_id=line_id, period_id=period_id, batch_id=batch_id, scale=4,
          supersede_of=sup(snapshots.CALC_CONTRIBUTION_AFTER_COMMISSION)); n += 1

    # persist / refresh the commission_calculations row
    if commission_amt is not None:
        conn.execute(
            """INSERT INTO commission_calculations(id, transaction_id, commission_rule_id,
               basis_amount_minor, rate_canonical, commission_minor, verification_level,
               created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_id("commission_calc"), txn_id, rule_id, basis_amt.minor if basis_amt else None,
             rule["rate_canonical"] if rule else None, commission_amt.minor, comm_lvl.value,
             utcnow_iso()),
        )
    return n


def post_batch(conn: sqlite3.Connection, batch_id: str, policy: CalculationPolicy,
               *, actor: str | None = None) -> dict:
    """Post a staged batch with full snapshot persistence. Transactional; no partial post."""
    status = batch_status(conn, batch_id)
    if status == ImportBatchStatus.POSTED.value:
        return {"posted_transactions": 0, "snapshots_created": 0, "already_posted": True}
    if status in (ImportBatchStatus.REJECTED.value, ImportBatchStatus.ROLLED_BACK.value):
        raise ValueError(f"cannot post batch in status {status}")
    locked = _period_locked_for(conn, batch_id)
    if locked:
        raise ValueError(f"cannot post into locked reporting period(s): {', '.join(locked)}")

    posted = 0
    snaps = 0
    with conn:
        txns = conn.execute(
            """SELECT * FROM transactions WHERE import_batch_id = ? AND posted = 0
               AND review_status != 'rejected'""",
            (batch_id,),
        ).fetchall()
        for txn in txns:
            lines = conn.execute(
                "SELECT * FROM transaction_lines WHERE transaction_id = ?", (txn["id"],)).fetchall()
            for line in lines:
                snaps += persist_line_snapshots(conn, txn, line, policy)
            conn.execute(
                "UPDATE transactions SET posted = 1, review_status = 'posted' WHERE id = ?",
                (txn["id"],))
            posted += 1
        conn.execute(
            "UPDATE import_batches SET status = ?, posted_at = ? WHERE id = ?",
            (ImportBatchStatus.POSTED.value, utcnow_iso(), batch_id))
        audit.record_event(conn, "batch_posted_with_snapshots",
                           f"posted {posted} transactions, {snaps} snapshots",
                           entity_kind="import_batch", entity_id=batch_id, actor=actor,
                           detail={"posted": posted, "snapshots": snaps})
    return {"posted_transactions": posted, "snapshots_created": snaps, "already_posted": False}
