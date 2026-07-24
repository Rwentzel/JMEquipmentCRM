# Finance-system audit vs. repository governance docs

Audited against: `DATA_BOUNDARIES.md`, `IMPLEMENTATION_PLAN_REVISED.md`, `LAUNCH.md`,
`PRODUCTION_READINESS_CHECKLIST.md`, root `.gitignore`. Verdicts are honest; "gap" means a
real, concrete shortfall, not an aspirational nice-to-have.

## Compliance summary
| Governance requirement | Source | Finance-system status |
|---|---|---|
| Private fields (price/cost/margin/vendor/qty/QB/customer-pricing) never in web tier or repo | DATA_BOUNDARIES | ✅ Compliant — those fields live only in gitignored `.data/`/`private/`; only code + sanitized fixtures committed |
| `.data/` never committed | LAUNCH §5, .gitignore | ✅ `.gitignore` (root + finance-system) blocks `.data/`, `*.db`, `private/`, `*.qbw/qbb/iif` |
| No live QuickBooks connection; QBDE 2024 is source of truth; SKU join defined but not live | READINESS §24 | ✅ Adapter boundary only (ADR-0006); opaque internal keys, SKU is a join candidate; no compat claim |
| Pricing "as-of dating"; internal/quote tier only | READINESS §7 | ✅ Versioned policies + append-only calculation snapshots provide as-of; nothing public |
| No credentials / secrets / live data in repo | IMPL §17 | ✅ None stored; scanner blocks secrets/PII; sanitized fixtures only |
| Tax per ship-to on final invoice (pass-through) | READINESS §13 | ✅ Tax excluded from revenue by policy (pass-through) |
| Backups of the private store | READINESS §20, LAUNCH §5 | 🟡 Backup implemented; restore validation/history not yet (gap #3) |
| Confidential-data leak prevention | DATA_BOUNDARIES, SECURITY | ✅ Heuristic scanner + redaction + opt-in managed pre-commit hook (limits stated) |

## Real gaps (concrete, prioritized)
| # | Gap | Impact | Disposition |
|---|---|---|---|
| 1 | **Single line per transaction** — multi-line invoices not modeled | Real invoices have many lines; today two lines share an invoice # → flagged as likely-duplicate | Exchange 3 (header/line model). Documented in KNOWN_LIMITATIONS |
| 2 | **Payment/credit cash application incomplete** | Invoice balance, partial/over-payment, unapplied cash, AR status not fully reconciled | Exchange 3. Payments stored + excluded from revenue today |
| 3 | **Backup restore validation/preview + history** | Backup exists; safe restore-into-separate-location + validation not yet | Exchange 3 (READINESS §20) |
| 4 | **No operator GUI** (CLI only before this release) | "No source-code editing for normal use" needs a UI | **Addressed this release** — local web operator console (`webapp.py`) |
| 5 | **No role-based access in finance-system** | `users` table exists but unused; single local operator only | Fine for single-operator local use; multi-user/auth is Exchange 3+ (mirror LAUNCH's OPS_TOKEN→SSO path) |
| 6 | **Vendor-cost evidence not configurable by type; crating recovery heuristic** | Cost verification doesn't yet accept alternative evidence; crating recovery = −cost when no crating revenue field | Exchange 3 |
| 7 | **No documented retention window for finance-system `.data/`** | LAUNCH §5 sets a retention posture for RFQ PII; the finance side lacked one | **Addressed this release** — `docs/RUNBOOK.md` §Retention |
| 8 | **XLSX intake untested without `openpyxl`** | Optional extra; real path runs only when installed | Documented (ADR-0007); gate test + real test both present |
| 9 | **QuickBooks import/export not implemented** | Adapter boundary only | By design (ADR-0006); no compat claim until authorized QB test |
| 10 | **Report-level as-of time travel is snapshot-granular** | `as_of` reproduces a calculation's prior value; full historical report rendering reads current verification | Exchange 3+; snapshot history is the reproducibility record |

## Cross-subsystem integrity checks performed
- The uploaded root `.gitignore` matches the committed one and contains the finance-system
  block — no drift.
- `parts-store/` reads only `src/data/*` (public, sanitized) and never `finance-system/`;
  the two data stores do not intersect.
- No finance-system module imports from `parts-store/`, and vice versa — clean separation.
- `DATA_BOUNDARIES.md` and `PRODUCTION_READINESS_CHECKLIST.md §24` now cross-reference the
  finance-system so the private-data home is documented.

## Bottom line
The finance-system is **consistent with every governance document** and safe for controlled
real-data activation as a local, single-operator monthly-close engine (CLI + local web
console). The remaining gaps are ERP-breadth items (multi-line, full cash application,
restore validation, roles) on the Exchange 3+ roadmap — none of them a confidentiality or
correctness regression.
