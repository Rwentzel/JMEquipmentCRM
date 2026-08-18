/**
 * RFQ → draft quote conversion.
 *
 * The route itself is thin; what matters is that nothing the customer asked
 * for is lost or silently mispriced on the way into a document they will see.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-rfq2q-"));

import { blankQuote, buildDoc } from "../src/lib/qc/logic";
import { qcDefaults, SEED_CATALOG } from "../src/lib/qc/data";
import { PARTS_MASTER } from "../src/lib/qc/partsMaster";
import { catalog } from "../src/data/catalog";
import type { QcQuotePart } from "../src/lib/qc/types";

const settings = qcDefaults();

/** Mirrors the mapping in /api/qc/from-rfq. */
function partsFromItems(
  items: { sku: string; qty: number; config?: string[]; source?: string }[],
): QcQuotePart[] {
  return items.map((it) => {
    const master = PARTS_MASTER.find((p) => p.sku === it.sku);
    const price = master && master.price > 0 ? master.price : 0;
    const base = master?.name ?? catalog.machines.find((m) => m.sku === it.sku)?.name ?? it.sku;
    const name = it.config?.length ? `${base} — ${it.config.join(" · ")}` : base;
    return { sku: it.sku, name, qty: Math.max(1, +it.qty || 1), price, rfq: price === 0 };
  });
}

test("known SKUs carry the master's name and price onto the quote", () => {
  const priced = PARTS_MASTER.find((p) => p.price > 0)!;
  const [line] = partsFromItems([{ sku: priced.sku, qty: 3 }]);
  assert.equal(line!.name, priced.name);
  assert.equal(line!.price, priced.price);
  assert.equal(line!.qty, 3);
  assert.equal(line!.rfq, false);
});

test("an unknown SKU becomes a visible RFQ line rather than being dropped or quoted at $0", () => {
  const lines = partsFromItems([{ sku: "NOT-A-REAL-SKU", qty: 2 }]);
  assert.equal(lines.length, 1, "the customer's line item must survive the conversion");
  assert.equal(lines[0]!.rfq, true, "must read as pending a price, not as free");
  assert.equal(lines[0]!.price, 0);
});

test("quantities are never zero or negative", () => {
  const lines = partsFromItems([{ sku: "X", qty: 0 }, { sku: "Y", qty: -5 }]);
  assert.ok(lines.every((l) => l.qty >= 1));
});

test("a converted parts request produces a valid customer document with no machine", () => {
  const q = blankQuote(null, SEED_CATALOG, settings, 0);
  q.machineId = null;
  q.base = 0;
  q.crating = 0;
  q.clientCompany = "Acme Container Corp.";
  q.parts = partsFromItems([{ sku: PARTS_MASTER.find((p) => p.price > 0)!.sku, qty: 2 }]);
  q.notes = "Created from RFQ-ABCD1234 (submitted 2026-07-01).";

  const doc = buildDoc(q, null, settings)!;
  assert.ok(doc, "a parts-only quote must still render a document");
  assert.equal(doc.client.company, "Acme Container Corp.");
  // Internal provenance must never reach the customer's copy.
  const json = JSON.stringify(doc);
  assert.ok(!json.includes("RFQ-ABCD1234"), "internal notes must not leak onto the client document");
  assert.ok(!json.toLowerCase().includes("margin"));
});

/* ---- what the customer asked for has to reach the quote they sign ---- */

test("a configured machine reaches the quote line as configured", () => {
  // Before this, the quote said "JME-VCS12-75" — the standard 230V, 75-inch
  // build — for a customer who chose 460V and a 90-inch frame, and that is the
  // document they are asked to sign.
  const [line] = partsFromItems([
    { sku: "JME-VCS12-75", qty: 1, config: ["Power: 5 HP / 460V 3Ø", "Frame height: 90 in (16″ head)"] },
  ]);
  assert.match(line!.name, /460V/);
  assert.match(line!.name, /90 in/);
  assert.ok(!/^JME-VCS12-75$/.test(line!.name), "a bare SKU tells the desk nothing");
});

test("a machine with no configuration still reads as its catalogue name", () => {
  const [line] = partsFromItems([{ sku: "JME-VCS12-75", qty: 1 }]);
  assert.equal(line!.name, catalog.machines.find((m) => m.sku === "JME-VCS12-75")!.name);
});

test("drawing provenance travels as desk context, not as part of the line", () => {
  // Where it was picked confirms fit; it is not part of what is being sold, so
  // it belongs in the notes rather than on the customer's line item.
  const source = "Goodstrong 1600-E · Driving (Timing) Belts · p.5-3 · #2";
  const items = [{ sku: "1808-8YU-50", qty: 2, source }];
  const [line] = partsFromItems(items);
  assert.ok(!line!.name.includes("p.5-3"), "the line stays about the part itself");

  const notes = items.filter((it) => it.source).map((it) => `${it.sku} picked from ${it.source}`);
  assert.deepEqual(notes, [`1808-8YU-50 picked from ${source}`]);
});
