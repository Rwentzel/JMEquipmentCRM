import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Point the store at a throwaway dir BEFORE importing it.
process.env.QC_DEMO_SEED = "1"; // these tests exercise the demo-seed path
process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-qc-test-"));

import {
  blankQuote,
  buildDoc,
  cashTotal,
  expiryInfo,
  genNumber,
  genToken,
  priceBreak,
  sortQuotes,
  stageProb,
  weightedTotal,
} from "../src/lib/qc/logic";
import { SEED_CATALOG, qcDefaults, seedQuotes } from "../src/lib/qc/data";
import { mutateQuote, patchQcState, readQcState, resetQcState } from "../src/lib/qc/store";
import type { QcQuote } from "../src/lib/qc/types";

const settings = qcDefaults();
const machineOf = (q: QcQuote) => SEED_CATALOG.find((m) => m.id === q.machineId) || null;

test("quote numbers follow Q-YY-MMDD-<seq>", () => {
  const n = genNumber(7, new Date("2026-06-08T12:00:00"));
  assert.equal(n, "Q-26-0608-08");
});

test("priceBreak: discount, tariff on base only, freight, margin", () => {
  const q = seedQuotes().find((x) => x.id === "q2")!; // 1650, base 495000, import
  q.discMode = "pct";
  q.discPct = 10;
  q.tariffPct = 15;
  q.freight = 2500;
  q.cost = 356400;
  const m = machineOf(q);
  const pb = priceBreak(q, m);
  assert.equal(pb.subtotal, 495000);
  assert.equal(pb.discount, 49500);
  assert.equal(pb.afterDisc, 445500);
  assert.equal(pb.tariff, 74250); // 15% of BASE, not afterDisc
  assert.equal(pb.total, 445500 + 74250 + 2500);
  assert.equal(pb.marginAmt, 445500 - 356400);
  assert.equal(pb.marginPct, 20);
});

test("parts lines: rfq lines contribute zero; qty multiplies", () => {
  const q = seedQuotes().find((x) => x.id === "q8")!; // vcs + 4 blades @185
  const m = machineOf(q);
  assert.equal(cashTotal(q, m), 17500 + 800 + 4 * 185);
  q.parts.push({ sku: "X", name: "RFQ item", qty: 3, price: 0, rfq: true });
  assert.equal(cashTotal(q, m), 17500 + 800 + 4 * 185);
});

test("weighted pipeline uses stage probabilities", () => {
  assert.equal(stageProb("draft"), 0.25);
  assert.equal(stageProb("sent"), 0.55);
  assert.equal(stageProb("accepted"), 0.9);
  assert.equal(stageProb("won"), 1);
  assert.equal(stageProb("lost"), 0);
  const q = seedQuotes().find((x) => x.id === "q2")!;
  const m = machineOf(q);
  assert.equal(weightedTotal(q, m), Math.round(cashTotal(q, m) * 0.55));
});

test("expiryInfo derives from createdAt + validity and only flags active statuses", () => {
  const q = { ...seedQuotes()[0]!, createdAt: "2020-01-01", validity: 30, status: "sent" as const };
  const e = expiryInfo(q);
  assert.equal(e.expired, true);
  assert.equal(e.active, true);
  const lost = { ...q, status: "lost" as const };
  assert.equal(expiryInfo(lost).active, false);
});

test("pipeline sort: status order draft→lost; value desc default direction semantics", () => {
  const qs = seedQuotes();
  const byStatus = sortQuotes(qs, { key: "status", dir: "asc" }, machineOf);
  const order = byStatus.map((q) => q.status);
  const ranks = order.map((s) => ["draft", "sent", "accepted", "won", "lost"].indexOf(s));
  for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i]! >= ranks[i - 1]!);
  const byValue = sortQuotes(qs, { key: "value", dir: "desc" }, machineOf);
  const vals = byValue.map((q) => cashTotal(q, machineOf(q)));
  for (let i = 1; i < vals.length; i++) assert.ok(vals[i]! <= vals[i - 1]!);
});

test("buildDoc is client-safe: no cost/margin anywhere in the payload", () => {
  const q = seedQuotes().find((x) => x.id === "q2")!;
  q.cost = 356400;
  const doc = buildDoc(q, machineOf(q), settings)!;
  const json = JSON.stringify(doc).toLowerCase();
  assert.ok(!json.includes("cost"));
  assert.ok(!json.includes("margin"));
  assert.ok(!("cost" in (doc as unknown as Record<string, unknown>)));
});

test("buildDoc payment splits 30-60-10 and 50-50", () => {
  const q = seedQuotes().find((x) => x.id === "q2")!; // 30-60-10
  const doc = buildDoc(q, machineOf(q), settings)!;
  assert.equal(doc.pricing.payment.length, 3);
  assert.match(doc.pricing.payment[0]!.label, /30% Due at Purchase Order/);
  const q50 = seedQuotes().find((x) => x.id === "q1")!;
  const doc50 = buildDoc(q50, machineOf(q50), settings)!;
  assert.equal(doc50.pricing.payment.length, 2);
});

test("store: seeds on first read, patches segments, resets", async () => {
  const s0 = await readQcState();
  assert.equal(s0.quotes.length, 8);
  assert.equal(s0.clients.length, 6);
  assert.ok(s0.catalog.length >= 8);
  await patchQcState({ clients: s0.clients.slice(0, 2) });
  const s1 = await readQcState();
  assert.equal(s1.clients.length, 2);
  assert.equal(s1.quotes.length, 8); // untouched segment preserved
  await resetQcState();
  const s2 = await readQcState();
  assert.equal(s2.clients.length, 6);
});

test("share tokens: store backfills every quote; new quotes carry one; tokens are long and unique", async () => {
  const s = await readQcState();
  for (const q of s.quotes) {
    assert.ok(q.token && q.token.length >= 32, `quote ${q.id} missing share token`);
  }
  assert.equal(new Set(s.quotes.map((q) => q.token)).size, s.quotes.length);
  const fresh = blankQuote(null, SEED_CATALOG, settings, 0);
  assert.ok(fresh.token && fresh.token.length >= 32);
  assert.notEqual(genToken(), genToken());
});

test("store: mutateQuote applies accept atomically and rejects unknown ids", async () => {
  const updated = await mutateQuote("q2", (q) => ({ ...q, status: "accepted", signedName: "M. Holt" }));
  assert.ok(updated);
  assert.equal(updated!.status, "accepted");
  const s = await readQcState();
  assert.equal(s.quotes.find((q) => q.id === "q2")!.signedName, "M. Holt");
  assert.equal(await mutateQuote("nope", (q) => q), null);
});

test("client doc resolves machine config from axis defaults when the quote stored none", () => {
  // Seeded/older quotes carry no `config`; the builder fills it in memory but
  // never writes it back. buildDoc must not render `" Head · " Frame`.
  const q = seedQuotes().find((x) => x.id === "q1")!; // vcs-12-75, configurable
  assert.equal(q.config, undefined, "fixture must be a quote with no stored config");
  const doc = buildDoc(q, machineOf(q), settings)!;
  assert.equal(doc.sku, "JME-VCS12-75");
  assert.equal(doc.machineSubtitle, '12" Head · 75" Frame');
  assert.doesNotMatch(doc.machineSubtitle, /^"|·\s*"\s/, "no empty placeholders left in the subtitle");
  // The configured axes still surface as specs on the customer's document.
  assert.ok(doc.specs.some((s) => s.k === "Core Head" && s.v === '12"'));
  assert.ok(doc.specs.some((s) => s.k === "Frame Length" && s.v === '75"'));
});

test("an explicit quote config still overrides the machine defaults", () => {
  const q = { ...seedQuotes().find((x) => x.id === "q1")!, config: { head: "14", frame: "45" } };
  const doc = buildDoc(q, machineOf(q), settings)!;
  assert.equal(doc.sku, "JME-VCS14-45");
  assert.equal(doc.machineSubtitle, '14" Head · 45" Frame');
});
