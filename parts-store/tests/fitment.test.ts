import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/data/catalog";
import { conflictingItems, fitsMachine, partsForMachine } from "../src/lib/fitment";

const machine = (sku: string) => {
  const m = catalog.machines.find((x) => x.sku === sku);
  assert.ok(m, `machine ${sku} in catalog`);
  return m!;
};

test("the core splitter shows its five VCS parts plus the two universal accessories", () => {
  const skus = partsForMachine(catalog.parts, machine("JME-VCS12-75")).map((p) => p.sku).sort();
  assert.deepEqual(skus, [
    "JME-ACC-TAP-001",
    "JME-ACC-TOL-001",
    "JME-VCS-ADA-001",
    "JME-VCS-BLD-001",
    "JME-VCS-HYD-001",
    "JME-VCS-HYD-002",
    "JME-VCS-KBH-001",
  ]);
});

test("the two Goodstrong sheeters share TC Series parts and the slitter blades", () => {
  const a = partsForMachine(catalog.parts, machine("GMC-TCII-1650")).map((p) => p.sku);
  const b = partsForMachine(catalog.parts, machine("GMC-1600E")).map((p) => p.sku);
  assert.ok(a.includes("JME-GMC-BLD-001") && b.includes("JME-GMC-BLD-001"));
  assert.ok(a.includes("JME-GMC-BEL-004") && b.includes("JME-GMC-BEL-004"));
  assert.ok(!a.includes("JME-MRT-BRG-001"), "rollstand bearing never lands on a sheeter");
  assert.ok(!a.includes("JME-VCS-BLD-001"), "splitter blade never lands on a sheeter");
});

test("the Martin rollstand gets only Martin parts and universals", () => {
  const skus = partsForMachine(catalog.parts, machine("GMM-RS-RB")).map((p) => p.sku);
  assert.equal(skus.filter((s) => s.startsWith("JME-MRT-")).length, 6);
  assert.equal(skus.length, 8);
});

test("machines with no published fitment show nothing — not a family dump", () => {
  for (const sku of ["JME-RR-16", "JME-GC-52", "JME-LD-12", "JME-AS-08", "JME-DC-04"]) {
    assert.deepEqual(partsForMachine(catalog.parts, machine(sku)), [], sku);
  }
});

test("generated web references (no fitment) are never matched to a machine", () => {
  const generated = catalog.parts.filter((p) => !p.fitment);
  assert.ok(generated.length > 2000, "sanity: the generated catalog is present");
  for (const m of catalog.machines) {
    assert.ok(generated.every((p) => !fitsMachine(p, m)), m.sku);
  }
});

test("a request-list part published for another machine is flagged; universals and machines are not", () => {
  const items = [
    { sku: "JME-MRT-BRG-001", name: "Arbor Bearing", qty: 1 },
    { sku: "JME-ACC-TAP-001", name: "Splicing Tape", qty: 2 },
    { sku: "GMC-1600E", name: "1600-E", qty: 1 },
    { sku: "JME-BRK-0001", name: "Fan Guard", qty: 1 },
    { sku: "JME-VCS-BLD-001", name: "Splitter Blade", qty: 1 },
  ];
  const flagged = conflictingItems(items, machine("JME-VCS12-75"), catalog.parts).map((i) => i.sku);
  assert.deepEqual(flagged, ["JME-MRT-BRG-001"]);
  assert.deepEqual(conflictingItems(items, machine("GMM-RS-RB"), catalog.parts).map((i) => i.sku), ["JME-VCS-BLD-001"]);
});
