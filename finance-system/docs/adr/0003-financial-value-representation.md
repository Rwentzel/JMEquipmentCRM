# ADR-0003: Financial-value representation

**Status:** Accepted (Exchange 1) · **Date:** 2026-07-15

## Context
Correction #8: authoritative financial values must never be stored as binary floating
point (SQLite `REAL`). Line amounts are typically 2 decimals; unit prices/costs can need up
to 4. We need exact arithmetic and lossless database round-trips.

## Decision
One consistent strategy for monetary amounts and quantities:
- **Integer minor units at a fixed scale of 4** (value × 10 000), stored in SQLite
  `INTEGER` columns (suffix `_minor`). Exact; covers 2- and 4-decimal cases; round-trips
  losslessly. Single currency **USD** this milestone, with a `currency` field carried so
  multi-currency is additive later.
- All arithmetic uses Python `decimal.Decimal` via the `Money` value object
  (`finance_system/money.py`). `float` never touches a money value.
- **Rounding** is `ROUND_HALF_UP` by default, surfaced as a policy choice (ADR-0005) so it
  is explicit and versioned.

Dimensionless **ratios** (commission rate, tax rate, percentages) are *not money*. They are
stored as validated **canonical decimal strings** (`TEXT`), never `REAL`, and parsed to
`Decimal` in the app layer.

## Consequences
- `0.1 + 0.2 == 0.3` holds exactly; tested in `test_money`/`test_db` including DB round-trip.
- Percentage results are `Decimal` or `None` when the denominator is zero — callers must
  handle `None` (tested), preventing divide-by-zero in reports.
- Sub-cent unit prices (scale > 4) round into scale 4 at construction; if a future need for
  greater unit-price precision appears, it is a scale bump in one place, documented here.

## Alternatives considered
- **Store as `REAL`.** Rejected outright (Correction #8): float rounding corrupts totals.
- **Canonical decimal strings for amounts too.** Viable, but integer minor units make
  SQL `SUM()` and comparisons exact and cheap; chosen for amounts. Strings are still used
  for the genuinely variable-precision ratios.
