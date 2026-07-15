# ADR-0008: Explicit report scope

**Status:** Accepted (Exchange 2.1) · **Date:** 2026-07-15

## Context
The Exchange 2 review found that several report queries aggregated **every** posted record
in the database rather than the records belonging to the selected batch/period. This is
correct on a single sanitized month but silently wrong once the database holds multiple
months, batches, or historical recalculations (cost breakdown vs total cost off by the
sales order's cost; global commission/exception/duplicate counts; units summed across
non-sales documents).

## Decision
Introduce an immutable :class:`ReportScope` (`scope.py`). Every report, count, total,
bridge, and reconciliation runs under an explicit scope that produces the shared SQL
predicate all scoped queries use. Rules:
- Monthly-close reports **require** a `reporting_period_id`.
- Batch reports **require** period *and* batch.
- An all-time report must set `all_time=True` explicitly — the engine never silently
  defaults to the whole database.
- Revenue, cost, gross profit, margin, markup, and units use the **same** sale-document
  population (`invoice`, `credit_memo`, `return`); the cost breakdown reconciles to total
  actual cost through an explicit bridge (raw posted components − non-sale-document cost −
  policy-excluded components = policy-recognized total).
- Commission totals come only from **current** (`is_current=1`) commission calculations in
  scope; a recalculation supersedes the prior row so it is never double counted.
- Current-snapshot selection is centralized in `snapshots.current_snapshots` (not
  re-derived per module), with an `assert_single_current` invariant.
- Every generated report runs integrity invariants and carries a reproducibility manifest;
  a failed invariant marks the report invalid and returns a non-zero CLI exit code.

## Consequences
- Reports are correct across multiple months/batches/recalculations, not just one.
- The cost/units/commission bridges make every headline number reconstructable and
  auditable.
- Slightly more verbose call sites (a scope must be constructed), which is the point:
  scope is explicit, never implicit.

## Alternatives considered
- **Add WHERE clauses ad hoc per query.** Rejected — that is exactly what produced the
  inconsistent scoping; a shared scope predicate prevents drift.
- **Default to all-time when no period is given.** Rejected — silent global scope is the
  defect being fixed.
