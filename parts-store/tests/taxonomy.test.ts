import { test } from "node:test";
import assert from "node:assert/strict";
import { TAXONOMY, subsystemOf } from "../src/data/taxonomy";
import { PARTS_PUBLIC } from "../src/data/partsCatalog";
import { catalog } from "../src/data/catalog";

test("every part classifies into exactly one subsystem of its family", () => {
  for (const p of PARTS_PUBLIC) {
    const fam = TAXONOMY.find((f) => f.family === p.cat);
    assert.ok(fam, `family missing from taxonomy: ${p.cat}`);
    const sub = subsystemOf(p);
    assert.ok(fam.subs.some((s) => s.name === sub), `${p.sku}: subsystem "${sub}" not in ${p.cat}`);
  }
});

test("subsystem counts sum to family counts", () => {
  for (const f of TAXONOMY) {
    const sum = f.subs.reduce((n, s) => n + s.count, 0);
    assert.equal(sum, f.count, `${f.family}: subs sum ${sum} != ${f.count}`);
  }
});

test("core splitter knives and knife holders group together (Blades & Knives)", () => {
  const knifeish = PARTS_PUBLIC.filter((p) => p.cat === "Core Splitter" && /knife|knives|holder/i.test(p.name));
  assert.ok(knifeish.length >= 5, "expected several core splitter knife parts");
  for (const p of knifeish) {
    assert.equal(subsystemOf(p), "Blades & Knives", `${p.sku} "${p.name}" landed in ${subsystemOf(p)}`);
  }
});

test("sheeter knife/blade/slitter parts land in Knives & Cutting", () => {
  const p = PARTS_PUBLIC.find((x) => x.cat === "Sheeter" && /slitter blade|knife holder/i.test(x.name));
  if (p) assert.equal(subsystemOf(p), "Knives & Cutting");
});

test("brake pads and rotors sit together in Pads & Discs", () => {
  const pads = PARTS_PUBLIC.filter((p) => p.cat === "Brakes" && /\b(pad|rotor|disc)s?\b/i.test(p.name));
  assert.ok(pads.length >= 5);
  for (const p of pads) assert.equal(subsystemOf(p), "Pads & Discs", `${p.sku} "${p.name}"`);
});

test("families are ordered largest-first for the browse rail", () => {
  for (let i = 1; i < TAXONOMY.length; i++) {
    assert.ok(TAXONOMY[i - 1]!.count >= TAXONOMY[i]!.count);
  }
});

/* ---- the bands the site promises have to exist ---- */

test('the "Freight Quote Required" band the site advertises is actually used', () => {
  // /freight, /terms and the FAQ each tell the customer that freight-heavy
  // items are "flagged 'Freight Quote Required' in the parts catalog", and the
  // home page prints it in the status-band legend. Nothing carried it: all 34
  // catalogue entries were "Quote Required", so the legend listed a badge that
  // never appeared and the desk's freight flag had no producer.
  const banded = [...catalog.machines, ...catalog.parts].filter(
    (x) => x.statusBand === "Freight Quote Required",
  );
  assert.ok(banded.length > 0, "a band the site names in three places cannot be unused");
  for (const m of catalog.machines) {
    assert.equal(
      m.statusBand,
      "Freight Quote Required",
      `${m.sku}: /freight says machines require freight quoting, so the badge has to say so`,
    );
  }
});

test("a machine request reaches the desk marked for freight", () => {
  // The flag was keyed on the CTA action, which no catalogue entry carried, so
  // FREIGHT never lit in the ops list and the notification subject never said
  // it — while the public page promised a freight quote alongside the machine.
  const freightSkus = new Set(
    [...catalog.machines, ...catalog.parts]
      .filter((x) => x.statusBand === "Freight Quote Required" || x.action === "freight-quote")
      .map((x) => x.sku),
  );
  assert.ok(freightSkus.has("JME-VCS12-75"), "a core splitter ships on a truck");
  assert.ok(!freightSkus.has("JME-VCS-HYD-002"), "a cylinder seal kit does not");
});
