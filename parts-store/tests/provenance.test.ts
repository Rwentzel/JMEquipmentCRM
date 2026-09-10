/**
 * Part-number provenance (BUILD_PROMPT.md, 2026-09-10): every SKU a customer
 * can see must exist in the catalogue export or on a cited factory-manual
 * page, and no invented code may pass for one. The configurator's option
 * choices are identifiers, not part numbers — they must never collide with
 * a real SKU, and the request item they ride on carries the machine's real
 * model number.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/data/catalog";
import { details } from "../src/data/details";
import { goodstrongDiagramSkus, goodstrongModels } from "../src/data/goodstrong";
import { PARTS_PUBLIC } from "../src/data/partsCatalog";

const machineSkus = new Set(catalog.machines.map((m) => m.sku));
const partSkus = new Set(catalog.parts.map((p) => p.sku));
const diagramSkus = new Set(goodstrongDiagramSkus());

test("catalogue SKUs are present, unique and never blank", () => {
  const all = [...catalog.machines, ...catalog.parts].map((x) => x.sku);
  assert.equal(new Set(all).size, all.length, "duplicate SKU in the catalogue");
  for (const s of all) assert.match(s, /^\S+$/, `blank or whitespace SKU: ${JSON.stringify(s)}`);
});

test("the public parts list is the catalogue's own parts", () => {
  for (const p of PARTS_PUBLIC) assert.ok(partSkus.has(p.sku), `${p.sku} is in the public list but not the catalogue`);
});

test("every manual model maps to a real machine, and every diagram row carries a page and a part number", () => {
  for (const m of goodstrongModels) {
    if (m.machineSku) assert.ok(machineSkus.has(m.machineSku), `${m.id} names machine ${m.machineSku}, which is not in the catalogue`);
    for (const [sectionId, pages] of Object.entries(m.diagrams)) {
      for (const page of pages) {
        assert.ok(page.pageLabel, `${m.id}/${sectionId} has a page with no label`);
        for (const part of page.parts) {
          assert.match(part.sku, /^\S+$/, `${m.id}/${sectionId} p.${page.pageLabel}: blank part number`);
          assert.ok(part.bubble >= 1, `${m.id}/${sectionId} p.${page.pageLabel}: ${part.sku} has no bubble`);
        }
      }
    }
  }
  assert.ok(diagramSkus.size > 0, "no diagram part numbers at all");
});

test("configurator choice ids are not part numbers and never collide with one", () => {
  for (const [machineSku, d] of Object.entries(details)) {
    assert.ok(machineSkus.has(machineSku), `detail page ${machineSku} has no machine`);
    for (const opt of d.options ?? []) {
      for (const c of opt.choices) {
        assert.ok(!partSkus.has(c.id) && !machineSkus.has(c.id) && !diagramSkus.has(c.id), `choice id ${c.id} on ${machineSku} collides with a real SKU`);
        assert.ok(c.v.trim().length > 0, `choice ${c.id} on ${machineSku} has no description`);
      }
    }
  }
});

test("a configured machine is requested under its real model number with descriptive text only", async () => {
  const { configLines } = await import("../src/lib/rfqConfig");
  const machine = "GMC-TCII-1650";
  const ids = (details[machine]?.options ?? []).flatMap((o) => o.choices.slice(0, 1).map((c) => c.id));
  const lines = configLines(machine, ids);
  assert.ok(lines.length > 0);
  for (const line of lines) for (const id of ids) assert.ok(!new RegExp(`\\b${id}\\b`).test(line), `coined id ${id} leaked into "${line}"`);
});
