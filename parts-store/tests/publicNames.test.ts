import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/data/catalog";

/**
 * Mirror of scripts/public_name_scrub.py is_code_token: 8+ alphanumerics with
 * at least one letter and four digits that are not a dimension (70x1020x1t),
 * a thread spec (M10x35x80B) or a number with a unit (1850MM). Those are
 * vendor / OEM style codes — cross-references the web-reference scheme keeps
 * private (DATA_BOUNDARIES.md).
 */
const DIM = /^[A-Za-z]?\d+(?:[.,]\d+)?(?:[xX×]\d+(?:[.,]\d+)?)+[A-Za-z]{0,2}$/;
const NUM_UNIT = /^\d+(?:[.,]\d+)?(?:mm|MM|cm|in|ft|W|L|T|t|A|V|HP|hp|kg|lb|pcs|pc)$/;
export function isCodeToken(tok: string): boolean {
  if (tok.length < 8) return false;
  const letters = (tok.match(/[A-Za-z]/g) ?? []).length;
  const digits = (tok.match(/\d/g) ?? []).length;
  if (letters < 1 || digits < 4) return false;
  return !DIM.test(tok) && !NUM_UNIT.test(tok);
}

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

test("no public part name carries a vendor or OEM style code", () => {
  const bad: string[] = [];
  for (const p of catalog.parts) {
    const codes = (p.name.match(/[A-Za-z0-9]+/g) ?? []).filter(isCodeToken);
    if (codes.length) bad.push(`${p.sku}: ${codes.join(", ")} in "${p.name}"`);
  }
  assert.deepEqual(bad, []);
});

test("the code rule keeps dimensions, thread specs and short model names", () => {
  for (const ok of ["70x1020x1t", "35X72X23", "M10x35x80B", "1850MM", "TC1600E", "STD1400", "Position2", "24VDC", "MP280"]) assert.ok(!isCodeToken(ok), ok);
  for (const code of ["BTBA11002C5", "60235K59", "Fmac11067", "MB2G2011008", "B10UE381W2I0690", "TX170M30", "01A14077"]) assert.ok(isCodeToken(code), code);
});

test("no public part name carries a purchasing, price, cost, supplier or reorder note", () => {
  const bad: string[] = [];
  for (const p of catalog.parts) {
    for (const [what, re] of LEAKS) if (re.test(p.name)) bad.push(`${p.sku}: ${what} in "${p.name}"`);
  }
  assert.deepEqual(bad, []);
});
