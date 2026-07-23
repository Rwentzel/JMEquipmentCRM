# ADR-0002: Public-repository / private-data boundary

**Status:** Accepted (Exchange 1) · **Date:** 2026-07-15

## Context
The repository is public. `DATA_BOUNDARIES.md` classifies sell price, cost, margin, vendor
name/part number, exact quantity, QuickBooks references, and customer-specific pricing as
**Private — never ship, never import into the web tier**. The finance system is built on
precisely this data. Gitignore alone is necessary but insufficient (Correction #7).

## Decision
Only **application code, database schema, documentation, and SANITIZED fixtures** are ever
committed. All authoritative confidential data lives outside git:
- SQLite DB under `finance-system/.data/` (gitignored).
- Real source files under `finance-system/private/` or `real-data/` (gitignored).

Defence in depth:
1. `finance-system/.gitignore` + root `.gitignore` exclude data dirs, `*.db`, and
   confidential export formats (`*.xlsx`, `*.qbw`, `*.iif`, ...).
2. A heuristic **confidential-data scanner** (`finance_system.scanner`) flags likely PII,
   pricing, bank/tax, and credential patterns, plus file-size/extension checks.
3. `scripts/safety_scan.py` runs the scanner over git-tracked and git-staged files and
   exits non-zero on any HIGH finding (wire into pre-commit or run manually).
4. Sanitized fixtures carry a `SANITIZED-FIXTURE` marker; value heuristics are relaxed for
   them, but secret/PII/bank/tax checks always run.
5. The audit log stores structural summaries only — never raw source strings.

## Consequences
- A single accidental `git add` of real data is caught by the scanner before commit, not
  after exposure — provided the operator runs the scan (documented, not yet enforced by a
  managed hook; see deficiencies).
- We explicitly **do not claim** the scanner guarantees confidentiality; it is heuristic and
  complements policy, review, and gitignore. Stated in `docs/THREAT_MODEL.md`.

## Alternatives considered
- **Entire app inside a gitignored `private/` folder.** Rejected: the code itself is not
  confidential and belongs under review/CI; only the *data* must stay out.
- **Separate private repository.** Viable and stronger for data isolation, but requires the
  user to provision it; recorded as a future option, not adopted unilaterally this exchange.
