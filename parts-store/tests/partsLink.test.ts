import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPartsLink, buildSkuLookup, parsePartsParam, PARTS_MAX_LINES, PARTS_MAX_QTY, type SkuLookup,
} from "../src/lib/partsLink";
import { catalog } from "../src/data/catalog";
import { goodstrongModels } from "../src/data/goodstrong";

const lookup: SkuLookup = new Map([
  ["p12109", { sku: "P12109", name: "Bearing For Aluminum Housing" }],
  ["b1462", { sku: "B1462", name: "Lift Arm Bearing-Ring" }],
  ["h3303-6415-2/15", { sku: "H3303-6415-2/15", name: "Slotted Part" }],
  ["jme-vcs12-75", { sku: "JME-VCS12-75", name: "Vertical Core Splitter" }],
]);

test("a link typed by the desk resolves to catalogue parts with quantities", () => {
  const r = parsePartsParam("P12109:2,B1462:1", lookup);
  assert.deepEqual(r, {
    items: [
      { sku: "P12109", name: "Bearing For Aluminum Housing", qty: 2 },
      { sku: "B1462", name: "Lift Arm Bearing-Ring", qty: 1 },
    ],
    dropped: 0,
  });
});

test("names come from the catalogue, never from the link", () => {
  // A crafted link cannot put text of its own into the request the desk reads:
  // the only thing that survives from the URL is the SKU, and only if we know it.
  const r = parsePartsParam("P12109:1", lookup);
  assert.equal(r.items[0]!.name, "Bearing For Aluminum Housing");
});

test("unknown SKUs are dropped, not passed through", () => {
  const r = parsePartsParam("P12109:1,NOT-A-PART:3,<script>:1", lookup);
  assert.equal(r.items.length, 1);
  assert.equal(r.dropped, 2);
});

test("tolerates how people type: spaces, case, trailing comma, missing quantity", () => {
  const r = parsePartsParam("  p12109 : 2 , B1462, ", lookup);
  assert.deepEqual(r.items.map((i) => [i.sku, i.qty]), [["P12109", 2], ["B1462", 1]]);
  assert.equal(r.dropped, 0);
});

test("a SKU containing a colon or slash still parses", () => {
  const r = parsePartsParam("H3303-6415-2/15:4", lookup);
  assert.deepEqual(r.items.map((i) => [i.sku, i.qty]), [["H3303-6415-2/15", 4]]);
});

test("quantities are clamped to what the API accepts", () => {
  const r = parsePartsParam(`P12109:0,B1462:-5,JME-VCS12-75:${PARTS_MAX_QTY + 1},H3303-6415-2/15:abc`, lookup);
  assert.deepEqual(r.items.map((i) => i.qty), [1, 1, PARTS_MAX_QTY, 1]);
});

test("a repeated SKU is merged, capped at the maximum", () => {
  const r = parsePartsParam(`P12109:3,P12109:4,B1462:${PARTS_MAX_QTY},B1462:1`, lookup);
  assert.deepEqual(r.items.map((i) => [i.sku, i.qty]), [["P12109", 7], ["B1462", PARTS_MAX_QTY]]);
});

test("the number of lines is capped and the excess counted", () => {
  const big: SkuLookup = new Map();
  for (let i = 0; i < PARTS_MAX_LINES + 10; i++) big.set(`sku${i}`, { sku: `SKU${i}`, name: `Part ${i}` });
  const raw = [...big.values()].map((v) => `${v.sku}:1`).join(",");
  const r = parsePartsParam(raw, big);
  assert.equal(r.items.length, PARTS_MAX_LINES);
  assert.equal(r.dropped, 10);
});

test("a hostile value cannot make the parser do unbounded work", () => {
  const raw = "P12109:1,".repeat(100_000);
  const t = Date.now();
  const r = parsePartsParam(raw, lookup);
  assert.ok(Date.now() - t < 500, "raw value must be length-limited before parsing");
  assert.equal(r.items.length, 1);
});

test("empty and absent values are a no-op", () => {
  assert.deepEqual(parsePartsParam("", lookup), { items: [], dropped: 0 });
  assert.deepEqual(parsePartsParam(null, lookup), { items: [], dropped: 0 });
  assert.deepEqual(parsePartsParam(undefined, lookup), { items: [], dropped: 0 });
});

test("buildPartsLink round-trips through the parser, slashes included", () => {
  const link = buildPartsLink("https://parts.jmequipment.net/", [
    { sku: "P12109", qty: 2 }, { sku: "H3303-6415-2/15", qty: 1 }, { sku: "", qty: 3 }, { sku: "B1462", qty: 0 },
  ]);
  assert.equal(link, "https://parts.jmequipment.net/?parts=P12109%3A2%2CH3303-6415-2%2F15%3A1");
  const value = new URL(link).searchParams.get("parts");
  const r = parsePartsParam(value, lookup);
  assert.deepEqual(r.items.map((i) => [i.sku, i.qty]), [["P12109", 2], ["H3303-6415-2/15", 1]]);
});

test("the lookup covers the public catalogue and every Goodstrong diagram part", () => {
  const lookup = buildSkuLookup(catalog, goodstrongModels);
  for (const p of catalog.parts.slice(0, 20)) assert.equal(lookup.get(p.sku.toLowerCase())?.sku, p.sku);
  for (const m of catalog.machines) assert.equal(lookup.get(m.sku.toLowerCase())?.sku, m.sku);
  let diagramParts = 0;
  for (const model of goodstrongModels) for (const pages of Object.values(model.diagrams)) for (const page of pages) for (const part of page.parts) {
    diagramParts++;
    assert.equal(lookup.get(part.sku.toLowerCase())?.name, part.name, `${part.sku} should resolve to its manual name`);
  }
  assert.ok(diagramParts > 0, "expected the manuals to carry diagram parts");
});

test("a prior part number on an old confirmation resolves to the current part", () => {
  const models = [{ diagrams: { hyd: [{ parts: [
    { sku: "NEW-100", name: "Timing Belt (current)", alsoKnownAs: ["OLD-100", "old-099"] },
  ] }] } }];
  const lookup = buildSkuLookup({ parts: [], machines: [] }, models);
  const r = parsePartsParam("OLD-100:2,OLD-099:1", lookup);
  assert.deepEqual(r.items, [{ sku: "NEW-100", name: "Timing Belt (current)", qty: 3 }]);
  assert.equal(r.dropped, 0);
});

test("a catalogue SKU is never overwritten by a colliding diagram alias", () => {
  const lookup = buildSkuLookup(
    { parts: [{ sku: "X-1", name: "Catalogue X-1" }], machines: [] },
    [{ diagrams: { d: [{ parts: [{ sku: "Y-2", name: "Diagram Y-2", alsoKnownAs: ["X-1"] }] }] } }],
  );
  assert.equal(lookup.get("x-1")?.name, "Catalogue X-1");
});

test("every diagram part carries a real name, so a parts link never shows a SKU as the name", () => {
  const lookup = buildSkuLookup(catalog, goodstrongModels);
  for (const [, v] of lookup) assert.ok(v.name && v.name !== v.sku, `${v.sku} has no name`);
});
