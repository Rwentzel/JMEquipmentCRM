/**
 * Link a storefront machine SKU to its Quote Center catalog entry.
 *
 * The two catalogs are separate lists kept for different audiences and they
 * share neither ids nor SKUs — the storefront's "GMC-TCII-1650" is the Quote
 * Center's `sheeter-1650` / "GMC-TC II 1650" — so the correspondence has to be
 * written down somewhere. This is that somewhere.
 *
 * Anything that is not confidently one specific Quote Center entry goes in
 * UNMAPPED with the reason instead of being guessed. A wrong guess here puts a
 * cut width or a rebuild tier the customer never chose onto a document they
 * sign; leaving it for the rep costs one dropdown.
 *
 * tests/machineFromRfq.test.ts fails when a storefront machine is in neither
 * table, so a machine added to the catalog cannot quietly go on being quoted
 * as "Replacement Parts & Components".
 */
import type { QcMachine } from "./types";

/** Storefront SKU → Quote Center catalog id, where the two are the same machine. */
export const STOREFRONT_TO_QC: Record<string, string> = {
  "JME-VCS12-75": "vcs-12-75",
  "GMC-TCII-1650": "sheeter-1650",
  "GMC-1600E": "sheeter-1600e",
  "GMM-RS-RB": "martin-customer",
  "JME-LD-12": "linear-dancer",
  "JME-AS-08": "splicer",
  "JME-DC-04": "decurler",
};

/** Storefront SKUs with no single right answer in the Quote Center, and why. */
export const UNMAPPED: Record<string, string> = {
  "JME-RR-16":
    "JME's own RollRite rollstand is a new JME build; the Quote Center's two rollstand entries are both Geo M. Martin machines.",
  "JME-GC-52":
    'The storefront lists one guillotine cutter; the Quote Center carries three Datien sizes (45", 54", 61"). Picking one asserts a cut width the customer never chose.',
};

/**
 * Resolve a storefront SKU to a machine in the *live* Quote Center catalog.
 *
 * The catalog is editable at runtime, so a mapped id that no longer exists
 * resolves to null rather than to a dangling machineId.
 */
export function resolveQcMachine(sku: string, catalog: QcMachine[]): QcMachine | null {
  const id = STOREFRONT_TO_QC[sku];
  if (!id) return null;
  return catalog.find((m) => m.id === id) ?? null;
}
