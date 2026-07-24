# Operational runbook — controlled real-data activation

Local, single-operator monthly close on Windows (or macOS/Linux). The engine is verified on
sanitized data; this runbook takes you to controlled **real-data** use safely.

## 0. What this is / is not
- **Is:** a local-first sales/cost/profitability/commission engine reproducing useful
  QuickBooks Desktop Enterprise 2024 **workflows** — CLI + a local browser console. Real
  financial data stays on your machine; nothing is committed or sent anywhere.
- **Is not:** a QuickBooks clone, a general ledger, or a live QuickBooks connection. No
  compatibility is claimed until tested against authorized QBDE 2024 exports.

## 1. Requirements
- **Python 3.11+** (`python --version`). No third-party packages required for the core.
- Optional: `pip install openpyxl` to import `.xlsx` files directly (otherwise export the
  sheet to CSV first — ADR-0007).

## 2. Install & verify
```
cd finance-system
python -m finance_system.cli selfcheck        # must print: integrity=PASS / OK
python -m unittest discover -s tests -t .      # optional: full test suite (124 tests)
```
If `selfcheck` prints `OK — installation is healthy`, the install is good.

## 3. Choose the private data location (keep it OFF any synced/committed folder)
The database and any real inputs must live in a private location that is **never** put in
git or a shared drive. By default the DB is `finance-system/.data/finance.db` (gitignored).
To place it elsewhere (recommended for real use), set an environment variable:
```
# Windows (PowerShell), per session:
$env:FINANCE_DATA_DIR = "C:\JMEquipment\finance-private"
# or pass --db on every CLI command:
python -m finance_system.cli --db "C:\JMEquipment\finance-private\finance.db" initialize
```
Put real source files under a sibling `private\` folder (gitignored). Never place real data
under any folder that is committed or cloud-synced without your controls.

## 4. Run the operator console (recommended)
```
python -m finance_system.webapp --db "C:\JMEquipment\finance-private\finance.db"
```
Open `http://127.0.0.1:8765` in a browser. The console binds to **loopback only** (not the
network). Workflow: Import (paste or CSV) → review duplicates/conflicts/exceptions → Post →
reconcile → resolve exceptions → generate a scoped report (integrity must show **PASS**) →
export → back up → lock the period. The CLI does the same headlessly.

## 5. First real month (controlled activation)
1. **Dry run first:** `... cli import <yourfile.csv> --period 2026-06 --dry-run` — review the
   staged summary; nothing is posted.
2. Confirm mapping confidence and that critical fields mapped (customer, type, qty, price).
3. Import for real, review, **post**, reconcile.
4. Resolve missing-cost / missing-commission exceptions with real evidence.
5. Generate the report; **do not trust a report whose integrity shows FAIL** (the CLI
   returns a non-zero exit code, exit 3, in that case).
6. Export the package, back up, then lock the period.

## 6. Backups & restore
- Back up before and after each close: console **Create backup**, or
  `python -m finance_system.cli backup --out "C:\JMEquipment\backups\finance-YYYYMM.db"`.
- Backups are plain SQLite files. **Test-restore into a NEW path** and run `selfcheck`
  against it before ever replacing an active database. (Automated restore validation/history
  is on the Exchange 3 roadmap; until then, restore = copy the backup file to a new path and
  verify with `selfcheck --db <that path>`.)

## 7. Confidentiality & retention (your responsibility)
- Only code, schema, docs, and **sanitized** fixtures are in git. Real data is yours to
  protect: keep `.data/`/`private/`/backups on an access-restricted local disk.
- Optional guard for this repo: `bash finance-system/scripts/install-safety-hook.sh` installs
  a repo-local pre-commit scan that blocks committing likely-confidential data (bypass with
  `git commit --no-verify`). It is heuristic, not a guarantee (see `THREAT_MODEL.md`).
- **Retention:** define and enforce a retention window for the private financial store and
  backups (e.g. keep 24 months, then archive/delete), mirroring the RFQ-store posture in the
  repo's `LAUNCH.md`. Do not keep real data longer than your policy requires.
- If confidential data is ever staged/committed, follow the incident procedure in
  `THREAT_MODEL.md`.

## 8. Health check any time
```
python -m finance_system.cli selfcheck
python -m finance_system.cli --db <yourdb> report --period 2026-06   # exit 3 if integrity fails
python finance-system/scripts/safety_scan.py                          # confidential-data scan
```

## 9. Known limitations before you scale up
See `docs/KNOWN_LIMITATIONS.md` — notably single-line transactions, partial payment/cash
application, and XLSX requiring `openpyxl`. These do not affect the correctness of what the
engine does compute; they bound what it currently models.
