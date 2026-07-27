# ADR-0005: Calculation-policy versioning

**Status:** Accepted (Exchange 1) · **Date:** 2026-07-15

## Context
Correction #4: the formula library must not assume one universal treatment. Revenue/cost
recognition, freight-in/out, customer freight revenue, crating, discounts, returns,
credits, taxes, deposits, partial shipments/invoices, labour, outside services, overhead,
commission basis and eligibility, currency precision, rounding, and period assignment are
all *policies*, and historical results must not be silently recomputed under a new policy.

## Decision
A `CalculationPolicy` (`finance_system/policies.py`) is an **immutable, named, versioned**
bundle of these choices. Formulas (`finance_system/formulas.py`) take an explicit policy —
they never hard-code a treatment. The seed policy is `jm-default@v1`; changing any treatment
means creating a **new version** (e.g. `jm-default@v2`), never mutating v1 in place.

Every calculation result is (or will be) captured as an append-only `CalculationSnapshot`
(`models.CalculationSnapshot`, `calculation_snapshots` table) retaining: policy key,
formula version, inputs, output value + kind, timestamp, source transaction/line, and
verification level. The snapshots table is append-only at the database level (triggers).

Commission basis is deliberately `None` in the default policy — it is **never assumed**; a
missing basis routes the commission to the exception register.

## Consequences
- A policy change is auditable and non-destructive: old snapshots keep pointing at the
  version that produced them; re-running under a new policy creates *new* snapshots.
- Reports can state exactly which policy/formula version produced each figure.
- Exchange 2 wires `compute_line` results into persisted snapshots at posting time (today
  the snapshot type and table exist; the smoke path persists verification levels and will
  persist full snapshots next).

## Alternatives considered
- **Global constants / hard-coded treatment.** Rejected (Correction #4): silent, unversioned,
  and would retroactively change historical numbers.
- **Per-report ad-hoc parameters.** Rejected: not reproducible; no single source of truth for
  which treatment produced a stored number.
