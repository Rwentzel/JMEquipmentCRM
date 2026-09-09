import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/data/catalog";
import { CONFIRM_CAP, familyByPrefix, foreignLines, partsForMachine } from "../src/lib/machineParts";

test("the core splitter's fitting parts are the curated VCS parts plus universal accessories", () => {
  const r = partsForMachine("JME-VCS12-75");
  const skus = r.fits.map((p) => p.sku);
  assert.ok(skus.includes("JME-VCS-BLD-001"), "splitter blade");
  assert.ok(skus.includes("JME-VCS-KBH-001"), "knife block holder");
  assert.ok(skus.includes("JME-ACC-TAP-001"), "universal splicing tape");
  // The design reference lists exactly these seven for the core splitter. The
  // adapter's text is a core size ("8-16 inch"), not a machine, and it belongs.
  assert.deepEqual(
    [...skus].sort(),
    ["JME-ACC-TAP-001", "JME-ACC-TOL-001", "JME-VCS-ADA-001", "JME-VCS-BLD-001", "JME-VCS-HYD-001", "JME-VCS-HYD-002", "JME-VCS-KBH-001"],
  );
});

test("the RollRite shows no confirmed parts but is offered the rollstand family to confirm", () => {
  const rr = partsForMachine("JME-RR-16");
  assert.equal(rr.fits.length, 0, "nothing is curated for the RollRite");
  assert.ok(rr.confirmTotal > 0);
  assert.ok(rr.confirm.every((p) => p.cat === "Rollstand"));
});

test("a machine with nothing curated and nothing in its family gets an honest empty state, not a sibling's parts", () => {
  // The old related-parts rule gave the RollRite the Martin rollstand's 87 parts.
  for (const sku of catalog.machines.map((m) => m.sku)) {
    const r = partsForMachine(sku);
    for (const p of r.fits) assert.ok(p.fitment, `${sku}: ${p.sku} in "fits" with no fitment text`);
    if (r.fits.length === 0 && r.confirmTotal === 0) assert.equal(r.confirm.length, 0);
  }
  const rr = partsForMachine("JME-RR-16");
  assert.ok(!rr.fits.some((p) => /martin/i.test(p.fitment ?? "")), "Martin parts must not be claimed to fit the RollRite");
});

test("family parts are offered as confirm-fitment, capped, with the real total", () => {
  const r = partsForMachine("GMC-TCII-1650");
  assert.ok(r.confirmTotal > CONFIRM_CAP);
  assert.equal(r.confirm.length, CONFIRM_CAP);
  assert.equal(r.family, "Sheeter");
  const fitSkus = new Set(r.fits.map((p) => p.sku));
  for (const p of r.confirm) assert.ok(!fitSkus.has(p.sku), "a part cannot be both fits and confirm");
});

test("nothing leaving the boundary carries a price, cost or quantity", () => {
  for (const m of catalog.machines) {
    const r = partsForMachine(m.sku);
    for (const p of [...r.fits, ...r.confirm]) {
      const keys = Object.keys(p);
      for (const k of keys) assert.doesNotMatch(k, /price|cost|margin|vendor|qty|quantity|bin/i, `${p.sku}.${k}`);
    }
  }
});

test("family-by-prefix is derived from the catalogue and covers every generated SKU", () => {
  const map = familyByPrefix();
  assert.equal(map["JME-SHT"], "Sheeter");
  assert.equal(map["JME-RST"], "Rollstand");
  let uncovered = 0;
  for (const p of catalog.parts) {
    const m = /^([A-Z]+-[A-Z]+)-/.exec(p.sku);
    if (m && !map[m[1]!]) uncovered++;
  }
  assert.equal(uncovered, 0);
});

test("the request-list guard flags lines from another family and leaves the rest alone", () => {
  const map = familyByPrefix();
  const lines = [{ sku: "JME-SHT-0096" }, { sku: "JME-RST-0044" }, { sku: "JME-VCS12-75" }, { sku: "NOT-A-CATALOG-SKU" }];
  assert.deepEqual(foreignLines(lines, "Sheeter", map).map((l) => l.sku), ["JME-RST-0044"]);
  assert.deepEqual(foreignLines(lines, null, map), [], "a machine with no family flags nothing");
});

test("universal accessories do not turn an unpublished machine into a two-item list", () => {
  for (const sku of ["JME-RR-16", "JME-GC-52", "JME-AS-08", "JME-DC-04"]) {
    assert.equal(partsForMachine(sku).fits.length, 0, `${sku} should show the empty state`);
  }
  // …but they still ride along with a machine that has parts of its own.
  assert.ok(partsForMachine("GMM-RS-RB").fits.some((p) => /universal/i.test(p.fitment ?? "")));
});
