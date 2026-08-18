# Changelog

## Exchange 3 — documents, cash application, evidence, crating, restore (2026-07-27)
Closes the ERP-breadth gaps recorded in `KNOWN_LIMITATIONS.md` / `AUDIT.md`.
- **Multi-line documents.** Source rows sharing a document identity (type + document number
  + party) now form ONE transaction with MANY lines. Document identity and line identity are
  separate, so a legitimate multi-line invoice is never mistaken for a duplicated document.
  Duplicate detection runs at three levels: document (`document_hash` / document identity),
  line (`find_duplicate_lines` — repeated source row inside a document), and source row.
  Header-vs-line reconciliation now sums ALL lines. Every line keeps its own source lineage.
- **Cash application (`cash.py`).** Invoice balance, partial payment, multiple payments,
  authorized overpayment, unapplied cash/deposits, credit and return application, and
  append-only reversal (never a mutation). AR status per invoice (open / partially paid /
  paid / overpaid) and a cash bridge that keeps **invoiced revenue**, **collected cash**, and
  **outstanding receivable** strictly separate. Surfaced in the A–K report, CLI
  (`receivables`), and the console (Receivables page).
- **Configurable vendor-cost evidence (`cost_evidence.py`).** A vendor bill is no longer
  universally required: purchase order, vendor quote, historical approved cost, authorized
  manual cost, manufacturer price list, freight/crating invoice, and internal labor record
  are all supported, each mapped to `verified`/`provisional`/`rejected` per policy and
  reconfigurable. Expired evidence is ignored; the strongest evidence wins.
- **Crating revenue and recovery.** New `customer_crating_minor` line field and mapping
  aliases. Crating recovery is now `customer crating revenue − actual crating cost`, not the
  negative-cost heuristic; when crating cost exists with no crating revenue the recovery is
  classified **unverified** rather than reported as a loss of fact.
- **Backup validation, restore preview, and safe restore (`backup.py`).** Backups are
  validated (integrity check, schema version, record counts, append-only triggers still
  present); `restore-preview` reports the deltas without touching the active database; and
  `restore` refuses invalid backups, requires explicit confirmation, and takes an automatic
  safety backup of the current database first. New CLI: `verify-backup`, `restore-preview`,
  `restore`, `receivables`.
- **Per-line resolution isolation (bug fix).** `_reclassify_line` read the *document's*
  source record and updated verification rows for the WHOLE transaction — on a multi-line
  invoice, resolving one line silently verified its siblings. It now reads the line's own
  source row and scopes the update to `transaction_line_id`.
- **Evidence-driven reclassification.** `resolution.apply_cost_evidence` (CLI:
  `evidence <line_id> --type purchase_order --amount ...`) records alternative evidence,
  re-classifies that line's cost against the acceptance policy, supersedes its snapshots, and
  records an audit event.
- Migration `0004_documents_cash_evidence.sql`. Tests: 134 → 171.

## Hardening sweep — defect fixes (2026-07-24)
Post-release code sweep; every item is a real defect found and fixed, with regression tests.
- **Exact money in duplicate matching.** `dedup._line_amount_minor` computed extended amounts
  with SQL **binary floating point** (`quantity_minor/10000.0 * price`), violating ADR-0003.
  Now computed in Python with `Money`/`Decimal` in exact integer minor units, so two identical
  documents can never compare unequal through float error.
- **Duplicate detection bounded and correct.** The likely-duplicate pool scanned *every posted
  transaction in the database* (unbounded growth across months) and used `b in staged` /
  `pool.index(b)` inside a nested loop (O(n) scans per pair → O(n³)). The pool is now limited
  to the batch's own reporting period(s) and pairing uses index arithmetic. Tests assert no
  self-pairs, no mirrored duplicates, and no cross-period comparison.
- **Commission-without-rule conflict implemented.** `conflicts.py` had a dead assignment that
  computed a query result and discarded it; a revenue line whose commission is unverified and
  has no authorized rule is now actually flagged (the basis is never assumed).
- **Customer-concentration metric was a stub.** `top_customer_posted_txn_count` was hard-coded
  to `0` in every report; it now computes the largest customer's scoped transaction count and
  adds `customers_in_scope`.
- **Operator errors are surfaced.** The web console silently swallowed `ValueError` on post /
  rollback / evidence-resolution, so a locked-period refusal looked like a no-op. Refusals and
  successes now redirect with a message and render as banners with corrective guidance.
- **CLI `--batch` without `--period` no longer crashes**; the period is derived from the batch,
  or an actionable error is printed (exit 1).
- Tests: 124 → 134.

## Operational release — operator console + activation (2026-07-15)
Makes the verified engine usable in real life without editing source code.
- **Local operator web console** (`webapp.py`, standard library only, loopback-only): guided
  monthly close — import (paste/CSV) → review duplicates/conflicts/exceptions → post →
  reconcile → resolve → scoped report with integrity status → export → backup. Calls the same
  tested services as the CLI; never writes to the database directly.
- **`selfcheck` CLI command** and `python -m finance_system` entry point for install health.
- **`docs/RUNBOOK.md`** — controlled real-data activation (private data location, dry run,
  backups/restore, retention, confidentiality) for Windows/macOS/Linux.
- **`docs/AUDIT.md`** — finance-system audited against `DATA_BOUNDARIES.md`,
  `IMPLEMENTATION_PLAN_REVISED.md`, `LAUNCH.md`, `PRODUCTION_READINESS_CHECKLIST.md`, and
  `.gitignore`; cross-references added in `DATA_BOUNDARIES.md` and readiness checklist §24.
- Console script entry points (`jm-finance`, `jm-finance-console`). Tests: 120 → 124.

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
