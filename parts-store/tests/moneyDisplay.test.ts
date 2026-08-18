import { test } from "node:test";
import assert from "node:assert/strict";
import { blankQuote, buildDoc, usd, usd2, usdAuto, priceBreak } from "../src/lib/qc/logic";
import { SEED_CATALOG, qcDefaults } from "../src/lib/qc/data";
import { PARTS_MASTER } from "../src/lib/qc/partsMaster";
import type { QcQuote } from "../src/lib/qc/types";

test("usdAuto shows cents only when there are cents", () => {
  assert.equal(usdAuto(1500), "$1,500");
  assert.equal(usdAuto(1500.5), "$1,500.50");
  assert.equal(usdAuto(224.85), "$224.85");
  assert.equal(usdAuto(0), "$0");
  assert.equal(usdAuto(NaN), "$0");
});

test("the builder's figure names the same amount as the client document's", () => {
  // The builder used usd() (whole dollars) while the document used usd2()
  // (cents), so a $1,500.50 quote read as $1,501 to the desk and $1,500.50 to
  // the customer. Whatever the precision shown, the amounts must agree.
  const strip = (s: string) => Number(s.replace(/[$,]/g, ""));
  for (const amount of [1500.5, 224.85, 899.4, 24999.04, 1500, 0]) {
    assert.equal(
      strip(usdAuto(amount)),
      strip(usd2(amount)),
      `builder ${usdAuto(amount)} vs document ${usd2(amount)}`,
    );
  }
});

test("catalogue parts that carry cents are not shown rounded to the dollar", () => {
  const withCents = PARTS_MASTER.filter((p) => Math.round((p.price ?? 0) * 100) % 100 !== 0);
  assert.ok(withCents.length > 0, "expected some catalogue parts to carry cents");
  for (const p of withCents) {
    assert.notEqual(usdAuto(p.price!), usd(p.price!), `${p.sku} at ${p.price} would show as ${usd(p.price!)}`);
  }
});

test("a quote line with a cents-priced part totals to the cent", () => {
  const part = PARTS_MASTER.find((p) => Math.round((p.price ?? 0) * 100) % 100 !== 0)!;
  const q = { parts: [{ sku: part.sku, name: part.name, qty: 4, price: part.price }] } as unknown as QcQuote;
  const pb = priceBreak(q, null);
  assert.equal(pb.subtotal.toFixed(2), (part.price! * 4).toFixed(2));
  // The desk multiplying the unit price it can see must land on the same total.
  const shownUnit = Number(usdAuto(part.price!).replace(/[$,]/g, ""));
  assert.equal((shownUnit * 4).toFixed(2), pb.subtotal.toFixed(2));
});

/* ---- a disclaimer must have something to disclaim ---- */

test("a parts quote does not carry the estimates disclaimer", () => {
  // It printed unconditionally, so a quote for four blades ended with
  //   Lead Time   Per line item
  //   Warranty    Per part
  //   * Estimates only. Not a financial guarantee. Based on industry averages.
  // with no asterisk anywhere for it to bind to. The nearest thing it appeared
  // to qualify was the lead time and the warranty — which are commitments.
  const q = blankQuote(null, SEED_CATALOG, qcDefaults(), 0);
  q.machineId = null;
  q.base = 0;
  q.parts = [{ sku: "JME-VCS-BLD-001", name: "Splitter Blade", qty: 4, price: 0, rfq: true }];
  const doc = buildDoc(q, null, qcDefaults())!;
  assert.equal(doc.roi.show, false);
  assert.equal(doc.hasDisclosures, false);
  assert.equal(doc.hasEstimates, false, "nothing on this document is an estimate");
});

test("a machine quote keeps it — the disclosure ranges are estimates", () => {
  // "$500–$1,500 electrical installation" and "$410–$830 annual operating cost"
  // are exactly what the line qualifies, with or without the ROI block.
  const m = SEED_CATALOG.find((x) => x.id === "vcs-12-75")!;
  const q = blankQuote("vcs-12-75", SEED_CATALOG, qcDefaults(), 0);
  q.roiOn = false;
  const doc = buildDoc(q, m, qcDefaults())!;
  assert.equal(doc.roi.show, false);
  assert.equal(doc.hasDisclosures, true);
  assert.equal(doc.hasEstimates, true);
});

test("a machine with no ROI model carries neither", () => {
  const m = SEED_CATALOG.find((x) => !x.roi)!;
  const doc = buildDoc(blankQuote(m.id, SEED_CATALOG, qcDefaults(), 0), m, qcDefaults())!;
  assert.equal(doc.hasEstimates, false, `${m.id} has no estimated figures on it`);
});
