import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Point the store at a throwaway dir BEFORE importing it.
process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-rfq-test-"));

import { saveRfq, listRfqs, getRfq, updateRfqStatus, rfqCounts } from "../src/lib/rfqStore";

const input = {
  contact: { company: "Acme Paper", name: "Pat", email: "pat@acme.com" },
  items: [{ sku: "JM108", qty: 2 }],
  freight: false,
};

let ref = "";

before(async () => {
  const saved = await saveRfq(input);
  ref = saved.ref;
});

test("saveRfq returns a crypto-random RFQ ref and status new", async () => {
  assert.match(ref, /^RFQ-[0-9A-F]{8}$/);
  const rfq = await getRfq(ref);
  assert.ok(rfq);
  assert.equal(rfq.status, "new");
  assert.equal(rfq.contact.company, "Acme Paper");
  assert.deepEqual(rfq.items, [{ sku: "JM108", qty: 2 }]);
});

test("listRfqs returns newest first and filters by status", async () => {
  const second = await saveRfq({ ...input, freight: true });
  const all = await listRfqs();
  assert.equal(all[0]!.ref, second.ref);
  const fresh = await listRfqs("new");
  assert.ok(fresh.length >= 2);
  assert.ok(fresh.every((r) => r.status === "new"));
});

test("updateRfqStatus moves lifecycle and bumps updatedAt", async () => {
  const updated = await updateRfqStatus(ref, "reviewing");
  assert.ok(updated);
  assert.equal(updated.status, "reviewing");
  assert.ok(Date.parse(updated.updatedAt) >= Date.parse(updated.createdAt));
});

test("updateRfqStatus returns null for unknown ref", async () => {
  assert.equal(await updateRfqStatus("RFQ-DOESNOTX", "won"), null);
});

test("rfqCounts tallies by status", async () => {
  const counts = await rfqCounts();
  assert.equal(counts.reviewing, 1);
  assert.ok(counts.new >= 1);
});

test("concurrent saves do not lose records", async () => {
  const beforeCount = (await listRfqs()).length;
  await Promise.all(Array.from({ length: 5 }, () => saveRfq(input)));
  const afterCount = (await listRfqs()).length;
  assert.equal(afterCount, beforeCount + 5);
});
