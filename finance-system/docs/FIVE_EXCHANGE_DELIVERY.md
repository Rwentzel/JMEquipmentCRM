# Five-Exchange Delivery — Build & Acceptance Tracker

Primary implementation agent: **Claude Code** (repository). Independent architect /
financial-logic reviewer / test designer / acceptance authority: **ChatGPT**.

Neither model's prior proposal is automatically authoritative; decisions follow inspection
of the real repository and environment.

| Exchange | Title | Status |
|---|---|---|
| 1 | Discovery, architecture, executable foundation | ✅ Conditionally accepted |
| 2 | Intake, classification, reconciliation, reporting | ✅ Delivered (awaiting review) |
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
**Status:** Delivered (awaiting review). **Tests:** 97 (43 Exchange-1 + 54 new), all pass.

### Exchange 1 regression corrections (required before expansion)
- **Defect 1 — snapshot persistence:** posting now writes an immutable snapshot for every
  material calculation (`snapshots.py`, `posting.persist_line_snapshots`), append-only via DB
  triggers; recalculation appends a new snapshot with `superseded_snapshot_id` set (originals
  preserved). Migration `0002` adds the full field set. Regression tests in `test_snapshots.py`.
- **Defect 2 — profitability population:** `reporting.py` maintains revenue-verified,
  cost-verified, and profitability-verified populations; verified margin/markup use only the
  profitability-verified population, with a reconciliation bridge (revenue excluded, reason,
  cost awaiting proof, GP excluded). Regression tests in `test_profitability.py`.

### Delivered scope
CSV/TSV/pasted/JSON intake (gated XLSX, ADR-0007); mapping profiles + confidence;
normalization with lineage; staging + calc-level classification; exact + likely duplicate
detection (never merged); conflict detection; transactional posting with snapshot
persistence; exception + evidence resolution; reconciliation with explicit tolerances; full
A–K report; CSV export; operator CLI; expanded fixtures; end-to-end demo (`demo.py`).

### Known deficiencies carried to review
See `docs/KNOWN_LIMITATIONS.md` (single-line transactions, XLSX untested here, limited
payment reconciliation, deterministic analytics only, heuristic scanner).

### Acceptance result
_Pending ChatGPT review._

## Exchange 3 — Operational application
_Not started._

## Exchange 4 — Business intelligence & adversarial hardening
_Not started._

## Exchange 5 — Release candidate, acceptance, handoff
_Not started._
