import { catalog } from "@/data/catalog";
import { details } from "@/data/details";
import { toPublicPart } from "@/data/sanitize";
import type { Part } from "@/data/types";

/**
 * Which parts a machine page may claim fit it.
 *
 * Two tiers, kept apart on purpose. "Fits" is the curated catalogue entries
 * whose fitment text names this machine — the desk has said so. "Confirm" is
 * everything else in the machine's family category: plausible, and offered
 * with a gold Confirm-fitment tag rather than presented as a match, because
 * for the generated catalogue nobody has checked. A machine with neither
 * shows an honest empty state instead of borrowing a sibling's parts — the
 * old related-parts rule handed the RollRite 87 Martin rollstand parts, which
 * is exactly the wrong-part-ships mistake the fitment guard exists to stop.
 *
 * No price, cost or quantity crosses this boundary: everything leaving is
 * passed through toPublicPart.
 */

/** Curated fitment text that names each machine. Absent = nothing curated. */
const NAMES: Record<string, RegExp> = {
  "JME-VCS12-75": /\bVCS\b/i,
  "GMC-TCII-1650": /\bTC( Series| II)?\b/i,
  "GMC-1600E": /\bTC ?1600E\b|\bTC II\b|\bTC Series\b/i,
  "GMM-RS-RB": /martin/i,
  "JME-RR-16": /rollrite/i,
  "JME-GC-52": /guillotine/i,
  "JME-LD-12": /linear dancer|dancer/i,
  "JME-AS-08": /splicer/i,
  "JME-DC-04": /decurler/i,
};

const UNIVERSAL = /^universal$/i;

export interface MachinePartsResult {
  fits: Part[];
  /** Same family, fitment unconfirmed. Capped; `confirmTotal` is the full count. */
  confirm: Part[];
  confirmTotal: number;
  /** Family category the machine's parts live under, for the catalogue link. */
  family: string | null;
}

export const CONFIRM_CAP = 12;

/** True when the fitment text names some machine other than `sku`. */
function namesAnotherMachine(fitment: string, sku: string): boolean {
  return Object.entries(NAMES).some(([other, re]) => other !== sku && re.test(fitment));
}

function fitsMachine(p: Part, sku: string, family: string | null): boolean {
  if (!p.fitment) return false;
  if (UNIVERSAL.test(p.fitment)) return true;
  const re = NAMES[sku];
  if (re && re.test(p.fitment)) return true;
  // A curated part in the machine's own family whose text describes a size or
  // option rather than a machine ("8-16 inch" on the core adapter) was curated
  // for this family. It fits — unless the text names a different machine, which
  // is what keeps the Martin rollstand's parts off the RollRite's page.
  return family !== null && p.cat === family && !namesAnotherMachine(p.fitment, sku);
}

export function partsForMachine(sku: string): MachinePartsResult {
  const family = details[sku]?.partsCat ?? null;
  const specific = catalog.parts.filter((p) => p.fitment && !UNIVERSAL.test(p.fitment) && fitsMachine(p, sku, family));
  // Universal accessories (splicing tape, a grinding stone) ride along with a
  // machine that has parts of its own. On their own they would turn every
  // "nothing published yet" machine into a two-item list of consumables, which
  // is the honest empty state the design asks for, dressed up as an answer.
  const fits = specific.length > 0 ? catalog.parts.filter((p) => fitsMachine(p, sku, family)) : [];
  const fitSkus = new Set(fits.map((p) => p.sku));
  const rest = family ? catalog.parts.filter((p) => p.cat === family && !fitSkus.has(p.sku)) : [];
  return {
    fits: fits.map(toPublicPart),
    confirm: rest.slice(0, CONFIRM_CAP).map(toPublicPart),
    confirmTotal: rest.length,
    family,
  };
}

/**
 * Family by SKU prefix, e.g. "JME-SHT" → "Sheeter", so the browser can tell
 * which machine a request-list line belongs to without shipping the whole
 * catalogue. Derived from the data rather than hand-written, so a new family
 * appears here the moment it appears in the catalogue.
 */
export function familyByPrefix(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of catalog.parts) {
    const m = /^([A-Z]+-[A-Z]+)-/.exec(p.sku);
    if (m && !out[m[1]!]) out[m[1]!] = p.cat;
  }
  return out;
}

/** Request-list lines whose SKU prefix places them under a different family. */
export function foreignLines<T extends { sku: string }>(
  lines: T[],
  family: string | null,
  prefixes: Record<string, string>,
): T[] {
  if (!family) return [];
  return lines.filter((l) => {
    const m = /^([A-Z]+-[A-Z]+)-/.exec(l.sku);
    const f = m ? prefixes[m[1]!] : undefined;
    return f !== undefined && f !== family && f !== "Other";
  });
}
