# JM Equipment — Digital Platform

**JM Equipment Inc.** · Converting Machinery Solutions · Sturgis, Michigan · Est. 1989

This repository contains the JME Parts Store: an RFQ-first storefront for
JM Equipment's machines and parts, with a hardened quote back end, an internal
ops desk, and built-in automation agents.

## Repository layout

| Path | What it is |
|------|------------|
| [`parts-store/`](parts-store/) | The Next.js application — storefront, quote API, ops desk, agents. See its [README](parts-store/README.md) for how to run it. |
| `PROJECT_STATE_AUDIT.md` · `RISK_REGISTER.md` · `PRODUCTION_READINESS_CHECKLIST.md` · `SECURITY_NOTES.md` · `DATA_BOUNDARIES.md` | Governance documents — read `DATA_BOUNDARIES.md` before touching any parts data. |
| `.github/workflows/ci.yml` | CI: type check, lint, tests, catalog integrity, and production build on every push and pull request. |

## Data protection (important)

This repository is **public**. The public parts catalog
(`parts-store/src/data/partsCatalog.ts`) contains only JME web reference
numbers, scrubbed descriptions, and availability bands. **Never commit**:

- Vendor or OEM part numbers, vendor names as sources, or vendor SKUs
- Prices, costs, margins, or exact stock quantities
- The private crosswalk (web ref → real part number / price / stock)
- Customer information of any kind

The public catalog is regenerated from the private parts export with
[`parts-store/scripts/generate-public-catalog.py`](parts-store/scripts/generate-public-catalog.py),
which asserts that no known real part number leaks into the output.

## Quick start

```bash
cd parts-store
npm install
npm run dev    # http://localhost:3000
```

## Workflow

All changes land through pull requests — propose on a branch, review, merge.
CI must be green before merging.
