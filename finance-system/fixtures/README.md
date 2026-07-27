# Sanitized fixtures

Every file here is **sanitized** and contains NO real JM Equipment business data. Names,
numbers, and identifiers are fabricated. Files carry a `SANITIZED-FIXTURE` marker so the
confidential-data scanner relaxes value heuristics for them (secret/PII/bank/tax checks
still always run).

**Never place real customer, pricing, cost, margin, commission, vendor, or contact data
here.** Real inputs belong in the gitignored `finance-system/private/` directory.

## `sample_month.json`
A synthetic reporting month exercising the eight required scenarios:

| Key | Scenario | What it proves |
|---|---|---|
| S1-verified | Fully verified | Happy path; positive margin; commission present |
| S2-cost-missing | Revenue verified, cost missing | Calculation-level split: revenue verified, cost + gross profit unverified |
| S3-commission-missing | Commission rule missing | Commission basis is never assumed → unverified → exception |
| S4-duplicate-candidate | Duplicate candidate | Same invoice number as S1 → flagged, not merged |
| S5-credit-return | Credit/return | Returns reduce revenue (negative net) |
| S6-freight-under-recovery | Freight under-recovery | Freight-out cost exceeds freight billed → reconciliation finding |
| S7-zero-revenue | Zero-revenue edge | Zero denominator → margin is `None`, no crash |
| S8-negative-margin | Negative margin | Sell price below cost → negative gross profit |

Amounts are **line totals in USD**; `unit_sales_price` is per unit. See
`finance_system/smoke.py` for how they are staged, classified, reconciled, and totalled.
