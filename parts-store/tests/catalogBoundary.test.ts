import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTS_PUBLIC } from "../src/data/partsCatalog";

/**
 * Data-boundary regression sweep over PUBLIC PART NAMES.
 *
 * The generated catalog once shipped a vendor part number and a cost inside
 * a description ("Tgw# 540062906-1 Tgw Cost- 121.90"). These patterns keep
 * that class of leak out of the client bundle permanently — the same rules
 * live in scripts/generate-public-catalog.py and the maintenance agent.
 */

const LEAK_PATTERNS: Array<[string, RegExp]> = [
  ["dollar amount", /\$\s?\d/],
  ["per-unit price value", /\b\d+\.\d{2}\s*\/\s*(?:ft|foot|ea|each|pc|set)\b/i],
  ["cost note", /\bcost\b/i],
  ["price note", /\bprice\b/i],
  ["margin/markup", /\b(margin|markup)\b/i],
  ["discount logic", /\bdiscount\b/i],
  ["wholesale reference", /\bwholesale\b/i],
  ["internal 'was part #' alias", /\bwas\s+part\s*#?/i],
  ["long vendor/OEM ref number", /\b\w*#\s*\d{5,}/],
  ["quickbooks reference", /\bquickbooks|qb\s*ref\b/i],
  ["bin location", /\bbin\s+[A-Z]?\d/i],
];

test("no public part name carries price, cost, vendor-ref, or internal-alias data", () => {
  const offenders: string[] = [];
  for (const p of PARTS_PUBLIC) {
    for (const [label, re] of LEAK_PATTERNS) {
      if (re.test(p.name)) offenders.push(`${p.sku} [${label}]: ${p.name}`);
    }
  }
  assert.deepEqual(offenders, [], `data-boundary leaks in public catalog:\n${offenders.join("\n")}`);
});

test("no public SKU deviates from the JME web-reference format", () => {
  for (const p of PARTS_PUBLIC) {
    assert.match(p.sku, /^JME-[A-Z]{3}-\d{4}$/, `unexpected sku format: ${p.sku}`);
  }
});
