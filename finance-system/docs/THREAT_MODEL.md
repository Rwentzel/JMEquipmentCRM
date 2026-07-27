# Threat & confidentiality model — finance-system

**Date:** 2026-07-15 · **Status:** Exchange 1 baseline.

This system processes JM Equipment's most sensitive data — sell prices, costs, margins,
commissions, vendor sourcing, and customer information — inside a **public** repository's
working tree. The overriding requirement: confidential data must never be committed,
logged, or otherwise exposed.

## Assets (what we protect)
- Pricing, cost, margin, and markup values.
- Vendor names, vendor part numbers, vendor bills, sourcing.
- Customer names, locations, contacts, customer-specific pricing.
- Commission rates and payouts; salesperson performance.
- Any credentials, bank, or tax identifiers (should not be in this system at all).

## Primary threats
1. **Accidental commit of real data** to the public repo (the dominant risk).
2. **Confidential values leaking into logs** or error messages.
3. **Confidential values in test fixtures or examples.**
4. **Bulk export files** (Excel/QuickBooks/DB dumps) checked in.
5. **Credentials/secrets** committed alongside code.

## Controls (defence in depth)
| # | Control | Where | Limitation |
|---|---------|-------|------------|
| 1 | Data dirs + data/export extensions gitignored | `.gitignore` (finance-system + root) | Gitignore can be overridden with `git add -f`. |
| 2 | Heuristic confidential-data scanner (PII, pricing, bank/tax, credentials, size, extension) | `finance_system/scanner.py` | Heuristic: false negatives/positives possible. |
| 3 | Safety scan over tracked + staged files, non-zero exit on HIGH | `scripts/safety_scan.py` | Only effective if actually run; not yet a managed pre-commit hook. |
| 4 | Sanitized fixtures only, marked `SANITIZED-FIXTURE`; secret/PII checks still run on them | `fixtures/` | Relies on authors using the marker + fake values. |
| 5 | Append-only, PII-free audit log (structural summaries only; forbidden-key guard) | `finance_system/audit.py` | Guard is a keyword denylist, not exhaustive. |
| 6 | Real data confined to gitignored SQLite under `.data/` | `finance_system/db.py` | OS-level file protection is the operator's responsibility. |
| 7 | No credentials/bank/tax IDs stored by design; flagged for removal if seen | schema + scanner | Enforced by convention + scan, not schema constraint. |

## Explicit non-guarantees
- The scanner **does not guarantee** confidentiality. It reduces the probability of an
  accidental leak; it can miss novel formats and raise false positives.
- Confidentiality ultimately depends on operator discipline and the security/retention
  controls of the machine and any storage the operator chooses.

## Incident procedure (if confidential data is staged or committed)
1. **Do not push.** If already pushed, treat the data as compromised.
2. Unstage: `git restore --staged <file>`; remove the file from the working tree or move it
   under a gitignored `private/` path.
3. If committed locally but not pushed: `git reset --soft HEAD~1` (or `git rm --cached` +
   amend) to remove it from the commit; re-run `scripts/safety_scan.py`.
4. If pushed: rotate/void any exposed credentials, notify the data owner (Riley), and use
   history-rewriting tools (e.g. `git filter-repo`) plus a force update per repo policy;
   assume the values are exposed regardless.
5. Record the incident and the remediation in `docs/FIVE_EXCHANGE_DELIVERY.md`.

## Redaction-safe errors & logs
- Application errors must not embed raw source rows or confidential values.
- `finance_system/audit.py` rejects detail payloads containing forbidden keys (raw, price,
  cost, margin, commission_rate, email, phone, bank, tax_id, ...).
