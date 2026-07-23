import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  discountAmt,
  expiryInfo,
  genNumber,
  lineSubtotal,
  paymentSchedule,
  priceBreak,
  resolvedTerms,
  stageProb,
  weightedTotal,
  type Quote,
} from "../src/lib/qc/pricing";

process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-qc-test-"));

import { acceptQuote, getQcState, getQuoteByToken, saveQuote, setQuoteStatus } from "../src/lib/qc/store";

function q(over: Partial<Quote> = {}): Quote {
  return {
    id: "q1", shareToken: "t", number: "Q-26-0101-01", status: "sent", machineId: null,
    clientCompany: "Acme", clientContact: "", clientDept: "", clientCity: "", clientEmail: "", po: "",
    base: 17500, crating: 800,
    addons: [{ label: "Spare blades", amount: 740 }],
    parts: [
      { sku: "A", name: "A", qty: 2, price: 100, rfq: false },
      { sku: "B", name: "B", qty: 5, price: 999, rfq: true },
    ],
    discMode: "amt", discAmt: 1000, discPct: 0, freight: 500, tariffPct: 10, taxPct: 5,
    cost: 12600, payment: "50-50", lead: "", warranty: "", validity: 60, rep: "",
    notes: "", lostReason: "", signedName: "", signedDate: "", createdAt: "2026-07-01",
    followUpDate: "", followUpNote: "", followUpDone: false, activity: [],
    ...over,
  };
}

/* ---- pricing engine (design parity) ---- */

test("subtotal = base + crating + addons + priced parts (RFQ lines excluded)", () => {
  assert.equal(lineSubtotal(q()), 17500 + 800 + 740 + 200);
});

test("price break: discount, tariff on BASE only, tax after discount, freight", () => {
  const quote = q();
  const pb = priceBreak(quote);
  assert.equal(pb.subtotal, 19240);
  assert.equal(pb.discount, 1000);
  assert.equal(pb.afterDisc, 18240);
  assert.equal(pb.tariff, 1750); // 10% of base 17500, not of subtotal
  assert.equal(pb.tax, Math.round(18240 * 0.05));
  assert.equal(pb.total, 18240 + 1750 + 500 + 912);
  assert.equal(pb.marginAmt, 18240 - 12600);
  assert.equal(pb.marginPct, Math.round(((18240 - 12600) / 18240) * 100));
});

test("percent discount mode and discount cap", () => {
  assert.equal(discountAmt(q({ discMode: "pct", discPct: 10 })), 1924);
  assert.equal(discountAmt(q({ discAmt: 999999 })), lineSubtotal(q()));
});

test("stage weights match the design (draft 25 / sent 55 / accepted 90)", () => {
  assert.equal(stageProb("draft"), 0.25);
  assert.equal(stageProb("sent"), 0.55);
  assert.equal(stageProb("accepted"), 0.9);
  assert.equal(stageProb("won"), 1);
  assert.equal(stageProb("lost"), 0);
  assert.equal(weightedTotal(q({ status: "draft" })), Math.round(priceBreak(q()).total * 0.25));
});

test("payment schedules split correctly", () => {
  const p = paymentSchedule("30-60-10", 1000);
  assert.deepEqual(p.map((x) => x.amount), ["$300.00", "$600.00", "$100.00"]);
  assert.equal(paymentSchedule("net30", 500)[0]!.amount, "$500.00");
  assert.equal(paymentSchedule("50-50", 0)[0]!.label, "Payment terms by consultation");
});

test("expiry math: 60-day validity from createdAt", () => {
  const info = expiryInfo(q({ createdAt: "2026-07-01", validity: 60 }), new Date("2026-07-11T12:00:00"));
  assert.equal(info.daysLeft, 50);
  assert.equal(info.expired, false);
  assert.ok(expiryInfo(q({ createdAt: "2026-01-01", validity: 30 }), new Date("2026-07-11")).expired);
});

test("quote numbers follow Q-YY-MMDD-NN", () => {
  assert.equal(genNumber(7, new Date("2026-07-09T12:00:00")), "Q-26-0709-07");
});

test("terms substitute validity and FOB", () => {
  const terms = resolvedTerms(45, "Sturgis, MI");
  assert.match(terms[0]!.d, /45 calendar days/);
  assert.match(terms[2]!.d, /FOB Sturgis, MI/);
});

/* ---- store + customer token flow ---- */

test("store round-trip: save assigns id/number/token; seed catalog present", async () => {
  const saved = await saveQuote({ clientCompany: "Acme Paper", base: 1000 });
  assert.match(saved.number, /^Q-\d{2}-\d{4}-\d{2}$/);
  assert.ok(saved.shareToken.length >= 20);
  const state = await getQcState();
  assert.equal(state.quotes.length, 1);
  assert.ok(state.catalog.length >= 10, "seed equipment catalog loads");
});

test("customer token flow: wrong token rejected, right token views + accepts", async () => {
  const saved = await saveQuote({ clientCompany: "Token Co", base: 500 });
  assert.equal(await getQuoteByToken(saved.id, "wrong-token", false), null);
  const viewed = await getQuoteByToken(saved.id, saved.shareToken);
  assert.ok(viewed);
  assert.ok(viewed.activity.some((a) => a.type === "viewed"), "view recorded");
  const accepted = await acceptQuote(saved.id, saved.shareToken, "Pat Lee");
  assert.ok(accepted);
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.signedName, "Pat Lee");
});

test("terminal quotes cannot be re-accepted", async () => {
  const saved = await saveQuote({ clientCompany: "Done Co" });
  await setQuoteStatus(saved.id, "lost", "Price");
  assert.equal(await acceptQuote(saved.id, saved.shareToken, "X"), null);
});

test("status change appends to the activity timeline", async () => {
  const saved = await saveQuote({ clientCompany: "Timeline Co" });
  const updated = await setQuoteStatus(saved.id, "sent");
  assert.ok(updated!.activity.some((a) => a.type === "sent"));
});
