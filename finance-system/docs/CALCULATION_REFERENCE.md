# Calculation & evidence reference

## Formulas (`finance_system/formulas.py`)
All money is exact integer minor units (scale 4); percentages are `Decimal` or `None` when
the denominator is zero. Every formula takes an explicit, versioned `CalculationPolicy`.

| Calculation | Formula |
|---|---|
| Gross line revenue | quantity × unit sales price |
| Net line revenue | gross − discounts − credits − returns + customer shipping + other authorized charges |
| Total actual cost | product + freight-in + freight-out + crating + labor + outside services + installation + travel + processing + tariffs + other (overhead only if authorized) |
| Gross profit | net revenue − total actual cost |
| Gross margin % | gross profit ÷ net revenue × 100 |
| Markup % | gross profit ÷ total actual cost × 100 |
| Unit actual cost | total actual cost ÷ quantity |
| Unit gross profit | unit sales price − unit actual cost |
| Commission | authorized basis amount × authorized rate (basis never assumed) |
| Contribution after commission | gross profit − commission |
| **Weighted gross margin %** | total gross profit ÷ total net revenue × 100 |
| **Weighted markup %** | total gross profit ÷ total actual cost × 100 |

### Verified margin (Defect 2)
Verified margin/markup use only the **profitability-verified** population — lines where
*both* revenue and cost are verified under the same policy:
```
Verified Gross Margin % = Profitability-Verified GP ÷ Profitability-Verified Net Revenue × 100
Verified Markup %       = Profitability-Verified GP ÷ Profitability-Verified Total Cost × 100
```
Revenue verified without verified cost appears in verified **revenue** totals but is excluded
from verified margin/markup denominators, with a reconciliation bridge explaining the gap.

## Calculation snapshots (`finance_system/snapshots.py`)
Posting persists an immutable snapshot per material calculation (gross/net/recognized
revenue, product cost, total actual cost, gross profit, gross margin, markup, unit cost,
unit gross profit, commission basis, commission amount, contribution after commission,
freight recovery, crating recovery). Each retains: id, entity type/id, line id, calculation
name, formula version, policy id + version, inputs, output value + kind + scale, verification
state, evidence basis, reporting period, import batch, timestamp, and superseded-snapshot id.
The table is append-only (DB triggers); corrections/policy changes append a new snapshot.

## Evidence matrix (`finance_system/evidence.py`)
Per calculation type, required + recommended fields. All required present → **verified**;
required present but a recommended field missing → **provisional**; a required field missing
→ **unverified** (opens an exception). Configurable per JM Equipment's documentation
standards without touching the engine.

| Calculation | Required | Recommended |
|---|---|---|
| Transaction identity | transaction_type, customer_id | invoice #, transaction date |
| Revenue | quantity, unit_sales_price | discount, customer_shipping, tax |
| Cost | product_cost | freight_in, freight_out |
| Gross profit | quantity, unit_sales_price, product_cost | freight_in, freight_out |
| Commission | commission_rule_id, commission_basis, commission_rate | — |
| Period assignment | period_assignment_date | — |
