# Operator guide — monthly close (Exchange 2)

Covers the CLI workflow, import specification, mapping, exception workflow, reconciliation,
and export. Everything runs locally against the private, gitignored database.

## Quick start (CLI)
From `finance-system/`:
```bash
python -m finance_system.cli initialize
python -m finance_system.cli import <file.csv> --period 2026-06        # stage + analyze (review)
python -m finance_system.cli import <file.csv> --period 2026-06 --post # stage + analyze + post
python -m finance_system.cli import <file.csv> --dry-run               # stage, show review, roll back
python -m finance_system.cli review  <batch_id>
python -m finance_system.cli post    <batch_id>
python -m finance_system.cli rollback <batch_id>                       # pre-post only
python -m finance_system.cli exceptions
python -m finance_system.cli resolve <exception_id> --product-cost 90.00 --vendor-bill VB-1
python -m finance_system.cli reconcile --period 2026-06
python -m finance_system.cli report  --period 2026-06                  # A–K report (JSON)
python -m finance_system.cli export  --period 2026-06                  # CSV package
python -m finance_system.cli safety-scan
python -m finance_system.cli backup
```
Exit codes: `0` ok · `1` error · `2` refused (locked period, exact-duplicate post, high scan finding).
The active database path is printed by `import`; override with `--db` or `FINANCE_DATA_DIR`.

## Import specification
Accepted formats: **CSV, TSV, pasted delimited text, JSON**; **XLSX/XLSM** only when the
optional `openpyxl` extra is installed (ADR-0007). One row = one transaction with a single
line (multi-line documents are an Exchange 3 item; see KNOWN_LIMITATIONS).

Lifecycle (reversible; a failed/rejected batch never partially posts):
register file → hash → preserve raw → parse → map → normalize → validate → detect exact +
likely duplicates → detect conflicts → classify evidence → stage → review → post
(transactional) → persist snapshots → exceptions → reconcile → A–K report → export.
Rollback is available before posting / before period lock.

## Mapping
Source headers are matched to normalized fields with a confidence of **exact / strong /
ambiguous / unmapped** (`mapping.map_headers`). Ambiguous or unmapped *critical* fields
(`transaction_type, customer, quantity, unit_sales_price`) require review. Header aliases
are configurable per `MappingProfile` (versioned, JSON-serializable). See
`finance_system/mapping.py` `DEFAULT_ALIASES` for the built-in spellings.

## Evidence & exception workflow ("Where's Your Proof?")
Verification is per **calculation** (identity, revenue, cost, profitability, commission,
period). A record can be revenue-verified yet cost/profit-unverified. Missing critical
evidence opens an exception with: type, entity, known amount, missing info, why it matters,
the exact acceptable evidence, affected calculations, priority, owner, and status
(`open → evidence requested → received → under review → resolved / rejected / waived`).
Resolving evidence (`resolution.supply_cost_evidence`) recalculates, **appends new
calculation snapshots superseding the prior ones (originals preserved)**, reclassifies, and
records the transition in the append-only audit log. A waiver never turns unsupported data
into verified fact — it stays visibly authorized and qualified.

## Reconciliation
`reconcile.reconcile_posted` applies rules with **explicit tolerances** (default money
tolerance 0.01): header-vs-line totals, freight revenue vs freight-out cost (under-recovery),
commission vs policy (basis × rate), period-assignment vs source dates, and duplicate
external identifiers. Each finding records rule, expected, actual, difference, tolerance,
status (`within_tolerance` / `exception`), severity, explanation, and related records.

## Export
`export.export_report` writes a timestamped package under the gitignored private export
directory (`.data/exports/…`): `report.json` plus CSVs for intake summary, verified records,
provisional records, exceptions, reconciliation findings, verified totals, provisional &
excluded totals, recommended actions, and audit summary. No export path outside the private
boundary is used.
