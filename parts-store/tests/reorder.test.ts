import { test } from "node:test";
import assert from "node:assert/strict";
import { matchReorder, normalizeRef } from "../src/lib/reorder";
import type { StoredRfq } from "../src/lib/rfqStore";

const rfq: StoredRfq = {
  ref: "RFQ-ABCD1234",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  status: "quoted",
  contact: { company: "Acme Paper", name: "Pat", email: "Pat@Acme.com", phone: "555-0100" },
  items: [{ sku: "JME-VCS-BLD-001", qty: 8 }, { sku: "JME-VCS-KBH-001", qty: 4 }],
  freight: false,
};

test("normalizeRef accepts the issued format only, case-insensitively", () => {
  assert.equal(normalizeRef(" rfq-abcd1234 "), "RFQ-ABCD1234");
  assert.equal(normalizeRef("RFQ-ABCD123"), null);
  assert.equal(normalizeRef("RFQ-UNSAVED-1234"), null);
  assert.equal(normalizeRef("../etc/passwd"), null);
  assert.equal(normalizeRef(null), null);
});

test("matchReorder returns SKU + qty only when the submitting email matches (case-insensitive)", () => {
  const items = matchReorder(rfq, "  PAT@acme.COM ");
  assert.deepEqual(items, [{ sku: "JME-VCS-BLD-001", qty: 8 }, { sku: "JME-VCS-KBH-001", qty: 4 }]);
  for (const it of items!) assert.deepEqual(Object.keys(it).sort(), ["qty", "sku"]);
});

test("matchReorder refuses a wrong or empty email, or a missing request, identically", () => {
  assert.equal(matchReorder(rfq, "someone@else.com"), null);
  assert.equal(matchReorder(rfq, ""), null);
  assert.equal(matchReorder(null, "pat@acme.com"), null);
});

test("matchReorder clamps quantities to a sane range", () => {
  const odd: StoredRfq = { ...rfq, items: [{ sku: "X", qty: 0 }, { sku: "Y", qty: 5000 }, { sku: "Z", qty: Number.NaN }] };
  assert.deepEqual(matchReorder(odd, "pat@acme.com"), [{ sku: "X", qty: 1 }, { sku: "Y", qty: 999 }, { sku: "Z", qty: 1 }]);
});
