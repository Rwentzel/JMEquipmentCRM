# Changelog

## Exchange 2.1 — reporting-integrity gate (2026-07-15)
Mandatory corrections from the Exchange 2 review, before any operator-interface work.
- **Explicit report scope (ADR-0008).** New `scope.py` `ReportScope`; every report/count/
  total/bridge runs under an explicit scope. Monthly reports require a period; batch reports
  require period+batch; all-time must be explicit. No query silently spans the whole DB.
- **Cost reconciliation.** Cost breakdown and total actual cost now use the same scope and
  sale-document population, reconciled by an explicit bridge (raw posted components −
  non-sale-document cost − policy-excluded = policy-recognized total). The former $200
  demo discrepancy is the sales order's product cost, now shown in the bridge, not hidden.
- **Units.** Units ordered/invoiced/returned/net-sold; quotes, sales orders, payments, and
  POs are excluded from units sold.
- **Commission.** `commission_calculations.is_current` (migration `0003`); totals count only
  current rows in scope; a recalculation supersedes the prior row (no double counting).
- **Scoped counts.** Exceptions, duplicates, conflicts, reconciliations, customers, invoices,
  units, and audit counts are scoped by batch/period (new scope columns, migration `0003`).
- **Centralized current-snapshot selection** (`snapshots.current_snapshots`, `as_of` support)
  with an `assert_single_current` invariant.
- **Connection lifecycle.** CLI opens one connection and closes it in `finally`; demo closes
  all handles. Suite and demo pass under `python -W error::ResourceWarning`.
- **Real XLSX test** when `openpyxl` is installed (generated sanitized workbook; numeric/date
  cells; formula cell per data-only policy; hidden sheet ignored). Gate test skips otherwise.
- **Report manifest + integrity assertions** (migration `0003` `report_manifests`); a failed
  invariant marks the report invalid and returns a non-zero CLI exit code.
- **Managed safety hook** (`scripts/install-safety-hook.sh`) — opt-in, repo-local, documented.
- Tests: 97 → 120 (119 pass, 1 environment-gated skip).

## Exchange 2 — intake, classification, reconciliation, reporting (2026-07-15)
### Financial-integrity corrections (from Exchange 1 review)
- **Defect 1 fixed:** calculation snapshots are now **persisted on posting** for every
  material calculation, immutable and append-only; corrections/policy changes append a new
  snapshot superseding the prior one (originals preserved). Migration `0002` adds the full
  snapshot field set. (`snapshots.py`, `posting.py`)
- **Defect 2 fixed:** verified margin/markup now use a distinct **profitability-verified
  population** (both revenue and cost verified). Revenue verified without verified cost stays
  in verified revenue but is excluded from margin/markup denominators, with a reconciliation
  bridge. (`reporting.py`)

### New capability
- Intake: CSV / TSV / pasted / JSON parsing; gated XLSX via optional `openpyxl` (ADR-0007).
- Mapping profiles with exact/strong/ambiguous/unmapped confidence.
- Normalization with preserved source lineage.
- Staging → exact + likely duplicate detection → conflict detection → transactional posting.
- Evidence resolution with recalculation, snapshot supersession, and reclassification.
- Reconciliation engine with explicit tolerances.
- Full A–K batch report; CSV export package; operator CLI; backup.
- Expanded sanitized fixture (`sample_month_v2.csv`) + end-to-end demo (`demo.py`).
- Tests: 43 → 97 (all passing).

### Schema
- Migration `0002_exchange2.sql`: snapshot fields; staging/review columns on transactions;
  `mapping_profiles`, `duplicate_candidates`, `override_authorizations`; extended
  `reconciliation_findings` and `exceptions`.

## Exchange 1 — executable foundation (2026-07-15)
- Money/formula core, versioned policies, calculation-level evidence & verification, generic
  transaction schema, reversible import batches, append-only audit, exception register,
  confidential-data scanner, sanitized fixtures, 43 tests, end-to-end smoke.
