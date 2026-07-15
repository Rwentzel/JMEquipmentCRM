# Changelog

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
