"""Report scope (Exchange 2.1, gate item 1).

Every report, count, total, and reconciliation runs under an explicit, immutable
``ReportScope``. The reporting engine never silently defaults to "every posted record in
the database": monthly reports require a reporting period, batch reports require a period
*and* a batch, and an all-time report must set ``all_time=True`` explicitly.

``ReportScope`` also produces the SQL predicate every scoped query shares, so scoping is
consistent instead of re-derived per query.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional

from .policies import CalculationPolicy, DEFAULT_POLICY

# The revenue-bearing sale-document population. Cost breakdown, total actual cost,
# revenue, gross profit, margin, and units-invoiced all use the SAME population.
REVENUE_TRANSACTION_TYPES = ("invoice", "credit_memo", "return")


@dataclass(frozen=True)
class ReportScope:
    calculation_policy_id: str
    calculation_policy_version: int
    reporting_period_id: Optional[str] = None
    import_batch_id: Optional[str] = None
    transaction_ids: Optional[tuple[str, ...]] = None
    customer_ids: Optional[tuple[str, ...]] = None
    vendor_ids: Optional[tuple[str, ...]] = None
    product_ids: Optional[tuple[str, ...]] = None
    salesperson_ids: Optional[tuple[str, ...]] = None
    revenue_transaction_types: tuple[str, ...] = REVENUE_TRANSACTION_TYPES
    posted_only: bool = True
    verification_population: str = "all"          # all | verified | profitability_verified
    evidence_matrix_version: str = "1"
    as_of_timestamp: Optional[str] = None
    include_superseded_snapshots: bool = False
    currency: str = "USD"
    all_time: bool = False

    # ---- constructors ----
    @classmethod
    def for_period(cls, reporting_period_id: str, policy: CalculationPolicy = DEFAULT_POLICY, **kw):
        if not reporting_period_id:
            raise ValueError("a monthly-close report requires a reporting_period_id")
        return cls(policy.name, policy.version, reporting_period_id=reporting_period_id,
                   currency=policy.currency, **kw)

    @classmethod
    def for_batch(cls, reporting_period_id: str, import_batch_id: str,
                  policy: CalculationPolicy = DEFAULT_POLICY, **kw):
        if not (reporting_period_id and import_batch_id):
            raise ValueError("a batch report requires both reporting_period_id and import_batch_id")
        return cls(policy.name, policy.version, reporting_period_id=reporting_period_id,
                   import_batch_id=import_batch_id, currency=policy.currency, **kw)

    @classmethod
    def all_time_scope(cls, policy: CalculationPolicy = DEFAULT_POLICY, **kw):
        return cls(policy.name, policy.version, all_time=True, currency=policy.currency, **kw)

    def validate(self) -> None:
        if not self.all_time and not self.reporting_period_id:
            raise ValueError(
                "ReportScope requires a reporting_period_id unless all_time=True is set explicitly")

    # ---- SQL predicates (shared by every scoped query) ----
    def base_predicate(self, alias: str = "t") -> tuple[str, list]:
        """Transaction-level predicate WITHOUT the transaction-type filter."""
        clauses: list[str] = []
        params: list = []
        if self.posted_only:
            clauses.append(f"{alias}.posted = 1")
        if not self.all_time and self.reporting_period_id:
            clauses.append(f"{alias}.reporting_period_id = ?")
            params.append(self.reporting_period_id)
        if self.import_batch_id:
            clauses.append(f"{alias}.import_batch_id = ?")
            params.append(self.import_batch_id)
        for col, ids in (("customer_id", self.customer_ids), ("vendor_id", self.vendor_ids),
                         ("salesperson", self.salesperson_ids)):
            if ids:
                clauses.append(f"{alias}.{col} IN ({','.join('?' * len(ids))})")
                params.extend(ids)
        if self.transaction_ids:
            clauses.append(f"{alias}.id IN ({','.join('?' * len(self.transaction_ids))})")
            params.extend(self.transaction_ids)
        sql = " AND ".join(clauses) if clauses else "1=1"
        return sql, params

    def revenue_predicate(self, alias: str = "t") -> tuple[str, list]:
        """Base predicate + the revenue/cost transaction-type population."""
        sql, params = self.base_predicate(alias)
        types = self.revenue_transaction_types
        sql += f" AND {alias}.transaction_type IN ({','.join('?' * len(types))})"
        params.extend(types)
        return sql, params

    def container_predicate(self, alias: str = "t") -> tuple[str, list]:
        """Batch/period container predicate WITHOUT posted or type filters — for intake
        counts (rows staged/posted/rejected) that span all transaction types and states."""
        clauses: list[str] = []
        params: list = []
        if self.import_batch_id:
            clauses.append(f"{alias}.import_batch_id = ?"); params.append(self.import_batch_id)
        elif not self.all_time and self.reporting_period_id:
            clauses.append(f"{alias}.reporting_period_id = ?"); params.append(self.reporting_period_id)
        sql = " AND ".join(clauses) if clauses else "1=1"
        return sql, params

    def scoped_batch_ids(self, conn) -> list[str]:
        if self.import_batch_id:
            return [self.import_batch_id]
        if not self.all_time and self.reporting_period_id:
            return [r[0] for r in conn.execute(
                "SELECT DISTINCT import_batch_id FROM transactions WHERE reporting_period_id=?",
                (self.reporting_period_id,)) if r[0]]
        return [r[0] for r in conn.execute("SELECT id FROM import_batches")]

    def to_dict(self) -> dict:
        return asdict(self)
