import { test } from "node:test";
import assert from "node:assert/strict";
import { TAXONOMY, subsystemOf } from "../src/data/taxonomy";
import { PARTS_PUBLIC } from "../src/data/partsCatalog";

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
