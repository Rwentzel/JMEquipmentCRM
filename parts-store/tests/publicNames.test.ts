import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/data/catalog";

/**
 * Public part names come from the private export through the generator's
 * scrub. These are the note shapes that have leaked before; the generator
 * strips them (scripts/generate-public-catalog.py PRICE_NOISE) and this
 * keeps the committed catalog honest between regenerations.
 */
const LEAKS: [string, RegExp][] = [
  ["purchasing note", /\b(?:min(?:imum)?\.?\s*(?:buy|order|purchase)|moq)\b/i],
  ["unit-price stub", /=?\s*\/\s*(?:each|ea)\b/i],
  ["money amount", /\$\s?\d/],
  ["cost note", /\bcosts?\s*(?::|=|\$|\d)/i],
  ["supplier fragment", /\bfrom\s+[A-Z][a-z]{2,}\s*$/],
  ["reorder / stock note", /\b(?:reorder|re-order|jm ?stock|buy from)\b/i],
];

test("no public part name carries a purchasing, price, cost, supplier or reorder note", () => {
  const bad: string[] = [];
  for (const p of catalog.parts) {
    for (const [what, re] of LEAKS) if (re.test(p.name)) bad.push(`${p.sku}: ${what} in "${p.name}"`);
  }
  assert.deepEqual(bad, []);
});
