/**
 * In-repo half of the part-number provenance gate (BUILD_PROMPT.md ruling 3).
 *
 * The generated public catalog is provenance-by-construction: every web
 * reference is minted from a QuickBooks row by scripts/generate-public-catalog.py
 * and mapped back through the private crosswalk. The hand-authored curated
 * parts in src/data/catalog.ts come from the JME Parts Master workbook under
 * its governance numbering, which this checks the shape of. Resolving them
 * against the workbook itself needs the private file and is a release-time
 * step (LAUNCH.md), not a CI one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/data/catalog";
import { PARTS_PUBLIC } from "../src/data/partsCatalog";

const generated = new Set(PARTS_PUBLIC.map((p) => p.sku));
const curated = catalog.parts.filter((p) => !generated.has(p.sku));

/** JME governance numbering: JME-<line>-<component>-<seq>. */
const GOVERNANCE = /^JME-[A-Z]{3}-[A-Z]{3}-\d{3}$/;
/** Web references minted by the generator: JME-<family>-<seq>. */
const WEB_REF = /^JME-[A-Z]{3}-\d{4}$/;

test("every curated part carries a JME governance number, unique and never a web reference", () => {
  assert.ok(curated.length >= 20, "sanity: the curated launch parts are present");
  const seen = new Set<string>();
  for (const p of curated) {
    assert.match(p.sku, GOVERNANCE, `${p.sku} is not JME governance numbering`);
    assert.ok(!WEB_REF.test(p.sku), `${p.sku} looks like a generated web reference`);
    assert.ok(!seen.has(p.sku), `${p.sku} appears twice`);
    seen.add(p.sku);
    assert.ok(p.fitment && p.description, `${p.sku} must state fitment and a description`);
  }
});

test("every generated part carries a web reference, and none is a governance number", () => {
  for (const p of PARTS_PUBLIC) assert.match(p.sku, WEB_REF, `${p.sku} is not a generated web reference`);
});

test("every machine carries a real model number of a known make", () => {
  for (const m of catalog.machines) assert.match(m.sku, /^(?:JME|GMC|GMM)-[A-Z0-9-]+$/, m.sku);
});
