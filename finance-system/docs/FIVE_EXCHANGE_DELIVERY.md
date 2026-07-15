# Five-Exchange Delivery — Build & Acceptance Tracker

Primary implementation agent: **Claude Code** (repository). Independent architect /
financial-logic reviewer / test designer / acceptance authority: **ChatGPT**.

Neither model's prior proposal is automatically authoritative; decisions follow inspection
of the real repository and environment.

| Exchange | Title | Status |
|---|---|---|
| 1 | Discovery, architecture, executable foundation | ✅ Delivered (awaiting review) |
| 2 | Intake, classification, reconciliation, reporting | ⏳ Pending review of #1 |
| 3 | Operational application (local UI) | ⛔ Not started |
| 4 | Business intelligence & adversarial hardening | ⛔ Not started |
| 5 | Release candidate, acceptance, handoff | ⛔ Not started |

---

## Exchange 1 — Discovery, architecture, and executable foundation

**Status:** Delivered. **Environment:** Python 3.11.15; stdlib only (no pytest/pandas/
openpyxl/network). **Branch:** `claude/quickbooks-sales-profitability-system-t4o0gy`.

### Required outputs & evidence
| Required | Delivered | Evidence |
|---|---|---|
| Repository inspection | Yes | Read `DATA_BOUNDARIES.md`, `rfqStore.ts`, `auditLog.ts`, `csv.ts`, `.gitignore`, CI; see PR body / report §1 |
| Security-boundary review | Yes | ADR-0002, THREAT_MODEL.md |
| Reusable-pattern review | Yes | Patterns reused (atomic write, gitignored data, append-only audit, RFC-4180); TS code not directly reusable (report §1) |
| Environment/dependency assessment | Yes | `pyproject.toml` (stdlib-only core; optional extras) |
| Architecture decision records | Yes | `docs/adr/0001..0006` |
| Threat & confidentiality model | Yes | `docs/THREAT_MODEL.md` |
| Core scaffolding | Yes | `finance_system/` package |
| Dependency configuration | Yes | `pyproject.toml` |
| Database strategy + initial migrations | Yes | `db.py`, `migrations/0001_initial.sql` |
| Money representation | Yes | `money.py` (integer minor units, scale 4), ADR-0003 |
| Calculation-policy interfaces | Yes | `policies.py`, `formulas.py`, ADR-0005 |
| Evidence-requirements model | Yes | `evidence.py` |
| Verification-state model (calc-level) | Yes | `verification.py` |
| Import-batch foundation + lineage | Yes | `imports.py`, source_files/source_records tables |
| Exception foundation | Yes | `exception_register.py`, `exceptions` table |
| Audit foundation (append-only) | Yes | `audit.py` + DB triggers |
| Sanitized fixtures (8 scenarios) | Yes | `fixtures/sample_month.json` |
| Unit tests (13 areas) | Yes | `tests/` — 43 tests, all pass |
| Repository safety scanner | Yes | `scanner.py`, `scripts/safety_scan.py` |
| End-to-end skeleton smoke test | Yes | `smoke.py` — runs, totals reconcile |

### Test result (Exchange 1)
`python -m unittest discover -s tests -t .` → **43 passed, 0 failed, 0 skipped.**

### Deficiencies / open items carried to review
- Full `CalculationSnapshot` persistence at posting time is modelled (type + table) but the
  smoke path persists verification levels, not yet complete snapshots. → Exchange 2.
- Weighted **verified** margin uses the verified-revenue bucket, which can include a line
  whose *cost* is unverified (revenue verified, GP excluded). This slightly understates the
  verified margin. Decide the intended denominator with the reviewer. → Exchange 2.
- Safety scan is run manually / in CI, not yet enforced as a managed pre-commit hook.
- No CSV/Excel intake yet (Exchange 2); intake is JSON-fixture-driven for the smoke slice.

### Acceptance result
_Pending ChatGPT review._

---

## Exchange 2 — Intake, classification, reconciliation, reporting
_Not started. Scope: CSV/Excel/pasted intake, mapping workflow, normalization,
calculation-level classification at scale, duplicate/conflict detection, staged review +
posting, exception creation/resolution with preserved history, reconciliation engine,
verified/provisional/exception reporting, Excel export, A–K batch output._

## Exchange 3 — Operational application
_Not started._

## Exchange 4 — Business intelligence & adversarial hardening
_Not started._

## Exchange 5 — Release candidate, acceptance, handoff
_Not started._
