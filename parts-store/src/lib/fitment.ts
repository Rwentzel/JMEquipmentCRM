import type { Machine, Part, RequestItem } from "@/data/types";

/**
 * Fitment guard for the Machine Platform.
 *
 * The public catalog carries a free-text `fitment` on the curated launch
 * parts ("TC Series", "All VCS", "Martin Rollstand", "Universal"). This maps
 * that text onto the nine published machines so a customer who has picked
 * their machine sees only what JME publishes as fitting it — and so a part on
 * their request list that belongs to a different machine can be flagged
 * before it reaches the desk.
 *
 * Honesty rules:
 *  - A machine with no published fitment shows an empty state, never a
 *    family-wide dump of generated parts. The 2,000-odd generated web
 *    references have no `fitment` and are never matched here.
 *  - "Universal" accessories fit every machine that has a published list.
 *  - A curated part whose fitment names a size rather than a machine
 *    ("8-16 inch" core adapter) falls back to the machine family, and only
 *    when no machine pattern claimed it.
 */

/** Which fitment strings each published machine claims. `null` = nothing published yet. */
const FITMENT_PATTERNS: Record<string, RegExp | null> = {
  "JME-VCS12-75": /\bVCS\b/i,
  "GMC-TCII-1650": /TC\s?II|TC Series/i,
  "GMC-1600E": /TC1600E|TC Series/i,
  "GMM-RS-RB": /Martin Rollstand/i,
  "JME-RR-16": null,
  "JME-GC-52": null,
  "JME-LD-12": null,
  "JME-AS-08": null,
  "JME-DC-04": null,
};

const UNIVERSAL = /^universal$/i;

/** Machine SKUs whose published fitment pattern claims this part (ignores universal / family fallback). */
export function publishedFor(part: Part): string[] {
  const f = part.fitment?.trim();
  if (!f || UNIVERSAL.test(f)) return [];
  return Object.entries(FITMENT_PATTERNS)
    .filter(([, re]) => re && re.test(f))
    .map(([sku]) => sku);
}

export function fitsMachine(part: Part, machine: Machine): boolean {
  const f = part.fitment?.trim();
  if (!f) return false;
  // Universal accessories join a machine's published list; a machine with
  // nothing published yet stays honestly empty rather than showing two
  // accessories as if they were its parts list.
  if (UNIVERSAL.test(f)) return FITMENT_PATTERNS[machine.sku] !== null;
  const claimed = publishedFor(part);
  if (claimed.length > 0) return claimed.includes(machine.sku);
  // Size-only fitment on a curated part: trust the family, but only when no
  // machine pattern claimed it, so "TC Series" never lands on a rollstand.
  return part.cat === machine.family && FITMENT_PATTERNS[machine.sku] !== null;
}

export function partsForMachine(parts: Part[], machine: Machine): Part[] {
  return parts.filter((p) => fitsMachine(p, machine));
}

/**
 * Request-list items that JME publishes as fitting a *different* machine than
 * the one selected. Items that are machines, unknown web references, or
 * universal accessories are never flagged — the desk confirms those from the
 * serial number anyway. Only a positive, published mismatch earns the tag.
 */
export function conflictingItems(items: RequestItem[], machine: Machine, parts: Part[]): RequestItem[] {
  const bySku = new Map(parts.map((p) => [p.sku, p]));
  return items.filter((it) => {
    const p = bySku.get(it.sku);
    if (!p) return false;
    const claimed = publishedFor(p);
    return claimed.length > 0 && !claimed.includes(machine.sku);
  });
}
