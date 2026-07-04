/**
 * Maintenance agent — automated health and integrity checks for the ops desk.
 *
 * Pure checks over the catalog plus live checks of the runtime store. All
 * deterministic; no LLM required. Run from the ops console or from
 * `npm run agent:maintenance` in CI/cron.
 */

import { catalog } from "@/data/catalog";
import { details } from "@/data/details";
import { toPublicMachine, toPublicPart } from "@/data/sanitize";
import { STATUS_BANDS } from "@/data/types";
import { listRfqs } from "@/lib/rfqStore";

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface MaintenanceReport {
  ok: boolean;
  checks: HealthCheck[];
  ranAt: string;
}

/** Catalog-only checks — pure and unit-testable. */
export function catalogChecks(): HealthCheck[] {
  const checks: HealthCheck[] = [];

  // 1. Every part category exists in the category filter list.
  const badCats = catalog.parts.filter((p) => !catalog.cats.includes(p.cat));
  checks.push({
    name: "part categories resolve",
    ok: badCats.length === 0,
    detail: badCats.length ? `unknown category on: ${badCats.map((p) => p.sku).join(", ")}` : `${catalog.parts.length} parts across ${catalog.cats.length} categories`,
  });

  // 2. Every machine detail page maps to a real machine SKU.
  const machineSkus = new Set(catalog.machines.map((m) => m.sku));
  const orphanDetails = Object.keys(details).filter((sku) => !machineSkus.has(sku));
  checks.push({
    name: "detail pages map to machines",
    ok: orphanDetails.length === 0,
    detail: orphanDetails.length ? `orphan detail keys: ${orphanDetails.join(", ")}` : `${Object.keys(details).length} detail pages`,
  });

  // 3. Every status band is one of the 7 allowed public bands.
  const badBands = [...catalog.machines, ...catalog.parts].filter(
    (x) => !(STATUS_BANDS as string[]).includes(x.statusBand),
  );
  checks.push({
    name: "status bands are public-safe",
    ok: badBands.length === 0,
    detail: badBands.length ? `invalid band on: ${badBands.map((x) => x.sku).join(", ")}` : "all bands within the 7 allowed values",
  });

  // 4. Data-boundary sweep: the sanitizer throws on any forbidden field.
  let boundaryOk = true;
  let boundaryDetail = "no forbidden fields on any catalog record";
  try {
    catalog.machines.forEach(toPublicMachine);
    catalog.parts.forEach(toPublicPart);
  } catch (err) {
    boundaryOk = false;
    boundaryDetail = err instanceof Error ? err.message : String(err);
  }
  checks.push({ name: "data-boundary sweep", ok: boundaryOk, detail: boundaryDetail });

  // 5. No duplicate SKUs across machines and parts.
  const allSkus = [...catalog.machines.map((m) => m.sku), ...catalog.parts.map((p) => p.sku)];
  const dupes = allSkus.filter((sku, i) => allSkus.indexOf(sku) !== i);
  checks.push({
    name: "SKUs are unique",
    ok: dupes.length === 0,
    detail: dupes.length ? `duplicates: ${[...new Set(dupes)].join(", ")}` : `${allSkus.length} unique SKUs`,
  });

  return checks;
}

/** Full report: catalog checks + runtime store reachability. */
export async function runMaintenance(): Promise<MaintenanceReport> {
  const checks = catalogChecks();

  try {
    const rfqs = await listRfqs();
    checks.push({ name: "RFQ store readable", ok: true, detail: `${rfqs.length} records` });
  } catch (err) {
    checks.push({
      name: "RFQ store readable",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  checks.push({
    name: "runtime",
    ok: true,
    detail: `node ${process.version}, uptime ${Math.round(process.uptime())}s`,
  });

  return { ok: checks.every((c) => c.ok), checks, ranAt: new Date().toISOString() };
}
