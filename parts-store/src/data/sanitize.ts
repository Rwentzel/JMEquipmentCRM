import type { Machine, Part, StatusBand } from "./types";
import { STATUS_BANDS } from "./types";

/**
 * Defense-in-depth data boundary (see DATA_BOUNDARIES.md).
 *
 * Even though the catalog is authored public-safe, every record is passed
 * through an allowlist here before it reaches a component. A forbidden key on
 * an input record throws in development so a bad import never ships silently.
 */

const FORBIDDEN_KEYS = [
  "price",
  "sellprice",
  "cost",
  "margin",
  "markup",
  "qty",
  "quantity",
  "onhand",
  "stockqty",
  "vendor",
  "vendorname",
  "vendorpartno",
  "oem",
  "oemref",
  "oemcrossref",
  "alias",
  "waspartno",
  "bin",
  "binlocation",
  "supplier",
  "suppliernotes",
  "qb",
  "qbref",
  "quickbooks",
  "customerprice",
];

function assertNoForbiddenKeys(record: Record<string, unknown>, label: string) {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase().replace(/[^a-z]/g, ""))) {
      throw new Error(
        `[data-boundary] forbidden field "${key}" on ${label} — internal data must never reach the client. See DATA_BOUNDARIES.md.`,
      );
    }
  }
}

/** Normalize any raw availability string to one of the 7 allowed public bands. */
export function normalizeBand(raw: string): StatusBand {
  const s = raw.toLowerCase();
  if ((STATUS_BANDS as string[]).includes(raw)) return raw as StatusBand;
  if (s.includes("discontinu")) return "Discontinued / Contact JM";
  if (s.includes("freight")) return "Freight Quote Required";
  if (s.includes("back")) return "Backorder";
  if (s.includes("limited") || s.includes("low")) return "Limited Stock";
  if (s.includes("in stock") || s === "stock") return "In Stock";
  if (s.includes("call")) return "Call for Availability";
  // Lead times, "consult", and anything unknown collapse to Quote Required.
  return "Quote Required";
}

/** Allowlist a Part to public fields only. */
export function toPublicPart(p: Part): Part {
  assertNoForbiddenKeys(p as unknown as Record<string, unknown>, `part ${p.sku}`);
  return {
    sku: p.sku,
    name: p.name,
    cat: p.cat,
    statusBand: normalizeBand(p.statusBand),
    action: p.action,
    description: p.description,
    category: p.category,
    fitment: p.fitment,
    keywords: p.keywords,
  };
}

/** Allowlist a Machine to public fields only. */
export function toPublicMachine(m: Machine): Machine {
  assertNoForbiddenKeys(m as unknown as Record<string, unknown>, `machine ${m.sku}`);
  return {
    sku: m.sku,
    name: m.name,
    family: m.family,
    tag: m.tag,
    tagLabel: m.tagLabel,
    statusBand: normalizeBand(m.statusBand),
    action: m.action,
    photo: m.photo,
    fit: m.fit,
    blurb: m.blurb,
    specs: m.specs.map((s) => ({ k: s.k, v: s.v })),
    bestFor: m.bestFor,
    outcomes: m.outcomes ? [...m.outcomes] : undefined,
  };
}
