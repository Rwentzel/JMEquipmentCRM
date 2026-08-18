/**
 * Closing a quote closes the request behind it.
 *
 * Nothing connected the two, so a storefront request stayed "quoted" for ever
 * — including after the customer signed. sweepRetention only purges terminal
 * RFQs, so every request that got as far as a quote sat permanently outside
 * whatever retention window JM sets, holding the contact's name, email, phone,
 * shipping address and machine serial. Those are exactly the records that
 * progressed furthest and hold the most.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-rfq-closure-"));
process.env.QC_DEMO_SEED = "0";

import { getRfq, saveRfq, updateRfqStatus } from "../src/lib/rfqStore";
import { mutateQuote, patchQcState, readQcState } from "../src/lib/qc/store";
import { quoteFromRfq } from "../src/lib/qc/fromRfq";
import { qcDefaults, SEED_CATALOG } from "../src/lib/qc/data";
import type { QcStatus } from "../src/lib/qc/types";

const settings = qcDefaults();

async function requestAndQuote(company: string) {
  const rfq = await saveRfq({
    contact: { company, name: "Kim", email: `kim@${company.toLowerCase()}.example`, phone: "555-0199" },
    items: [{ sku: "JME-VCS12-75", qty: 1 }],
    freight: false,
  });
  const state = await readQcState();
  const q = quoteFromRfq(rfq, SEED_CATALOG, settings, state.quotes.length);
  q.status = "sent";
  await patchQcState({ quotes: [q, ...state.quotes] });
  // What /api/qc/from-rfq does after converting.
  await updateRfqStatus(rfq.ref, "quoted");
  return { ref: rfq.ref, id: q.id };
}

test("a quote records which request it came from", async () => {
  // Kept as a field, not left to the "Created from RFQ-…" line in the notes —
  // that is free text a rep can edit away.
  const { ref, id } = await requestAndQuote("RefCo");
  const q = (await readQcState()).quotes.find((x) => x.id === id)!;
  assert.equal(q.rfqRef, ref);
});

test("the customer's signature closes the request", async () => {
  const { ref, id } = await requestAndQuote("SignCo");
  assert.equal((await getRfq(ref))!.status, "quoted", "open while the desk is still working it");

  await mutateQuote(id, (q) => ({ ...q, status: "accepted" as QcStatus, signedName: "Kim Alvarez" }));
  assert.equal((await getRfq(ref))!.status, "won", "a signed quote means the request is finished");
});

test("the desk marking a quote lost closes the request too", async () => {
  const { ref, id } = await requestAndQuote("LostCo");
  const state = await readQcState();
  await patchQcState({
    quotes: state.quotes.map((q) => (q.id === id ? { ...q, status: "lost" as QcStatus } : q)),
    knownQuoteIds: state.quotes.map((q) => q.id),
  });
  assert.equal((await getRfq(ref))!.status, "lost");
});

test("both write paths close the request, not just the desk's", async () => {
  // The first cut wired this into patchQcState only. Every unit test passed and
  // the running server did nothing on acceptance — which arrives through
  // mutateQuote, the one transition that matters most.
  const desk = await requestAndQuote("DeskPath");
  const client = await requestAndQuote("ClientPath");

  const state = await readQcState();
  await patchQcState({
    quotes: state.quotes.map((q) => (q.id === desk.id ? { ...q, status: "won" as QcStatus } : q)),
    knownQuoteIds: state.quotes.map((q) => q.id),
  });
  await mutateQuote(client.id, (q) => ({ ...q, status: "accepted" as QcStatus }));

  assert.equal((await getRfq(desk.ref))!.status, "won", "patchQcState must close it");
  assert.equal((await getRfq(client.ref))!.status, "won", "mutateQuote must close it");
});

test("a request the desk has already filed itself is left alone", async () => {
  // Reconciling unconditionally would fight whoever is working the list.
  const { ref, id } = await requestAndQuote("ArchivedCo");
  await updateRfqStatus(ref, "archived");
  await mutateQuote(id, (q) => ({ ...q, status: "accepted" as QcStatus }));
  assert.equal((await getRfq(ref))!.status, "archived");
});

test("a quote with no source request closes nothing and throws nothing", async () => {
  const state = await readQcState();
  const q = { ...state.quotes[0]!, id: "q-orphan", rfqRef: undefined, status: "sent" as QcStatus };
  await patchQcState({ quotes: [q, ...state.quotes], knownQuoteIds: state.quotes.map((x) => x.id) });
  await mutateQuote("q-orphan", (x) => ({ ...x, status: "accepted" as QcStatus }));
  assert.equal((await readQcState()).quotes.find((x) => x.id === "q-orphan")!.status, "accepted");
});
