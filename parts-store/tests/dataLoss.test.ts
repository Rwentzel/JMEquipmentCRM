/**
 * Data-loss regression tests.
 *
 * Every case here corresponds to a way real work disappeared: a customer's
 * signature erased by a stale browser tab, a quote book replaced by demo data
 * because one byte of the file was damaged, an RFQ book wiped by the next
 * form submission. They are written as "the data is still there afterwards"
 * assertions rather than unit tests of the mechanism, so a future rewrite of
 * the storage layer still has to satisfy them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Point both stores at a throwaway dir BEFORE anything reads the env.
// dataDir() resolves it per call, so static imports below are safe.
const DIR = mkdtempSync(path.join(tmpdir(), "jme-dataloss-"));
process.env.QC_DEMO_SEED = "1"; // these tests exercise the demo-seed path
process.env.RFQ_DATA_DIR = DIR;

import { mutateQuote, patchQcState, readQcState, resetQcState } from "../src/lib/qc/store";
import { listRfqs, saveRfq } from "../src/lib/rfqStore";
import type { QcQuote } from "../src/lib/qc/types";

const qcFile = () => path.join(DIR, "qc.json");
const rfqFile = () => path.join(DIR, "rfqs.json");

async function freshStore() {
  await resetQcState();
  return readQcState();
}

/* ---------------------------------------------------- stale-tab clobber --- */

test("a stale tab cannot roll back a quote the customer signed", async () => {
  const before = await freshStore();
  const target = before.quotes.find((q) => q.status === "sent")!;

  // The tab's snapshot, taken before the customer acts.
  const staleSnapshot: QcQuote[] = JSON.parse(JSON.stringify(before.quotes));

  // Customer signs (server-side, the tab knows nothing about it).
  await mutateQuote(target.id, (q) => ({ ...q, status: "accepted", signedName: "Marcus Holt", signedDate: "Jul 27, 2026" }));

  // The tab then saves an unrelated edit, sending its whole stale array.
  staleSnapshot[0] = { ...staleSnapshot[0]!, notes: "unrelated edit" };
  const { state, conflicts } = await patchQcState({ quotes: staleSnapshot });

  const after = state.quotes.find((q) => q.id === target.id)!;
  assert.equal(after.status, "accepted", "signed status must survive a stale write");
  assert.equal(after.signedName, "Marcus Holt", "signature must survive a stale write");
  assert.ok(conflicts.includes(target.id), "the refused quote is reported back to the client");
  // The unrelated edit still lands — only the stale quote is refused.
  assert.equal(state.quotes.find((q) => q.id === staleSnapshot[0]!.id)!.notes, "unrelated edit");
});

test("a client write carrying the current rev is accepted", async () => {
  const before = await freshStore();
  const current = before.quotes.map((q) => ({ ...q }));
  current[0] = { ...current[0]!, notes: "first edit" };
  const first = await patchQcState({ quotes: current });
  assert.equal(first.conflicts.length, 0);

  // Client reconciles (as the app does) and edits again — still no conflict.
  const reconciled = first.state.quotes.map((q) => ({ ...q }));
  reconciled[0] = { ...reconciled[0]!, notes: "second edit" };
  const second = await patchQcState({ quotes: reconciled });
  assert.equal(second.conflicts.length, 0);
  assert.equal(second.state.quotes[0]!.notes, "second edit");
});

test("deleting a quote still works (membership follows the client)", async () => {
  const before = await freshStore();
  const keep = before.quotes.slice(1);
  const { state } = await patchQcState({ quotes: keep });
  assert.equal(state.quotes.length, before.quotes.length - 1);
});

/* ------------------------------------------------------- corrupt stores --- */

test("a damaged qc.json is quarantined, never overwritten by seed data", async () => {
  const real = await freshStore();
  const signed = real.quotes[0]!.id;
  await mutateQuote(signed, (q) => ({ ...q, signedName: "Real Customer", status: "accepted" }));
  const goodBytes = await readFile(qcFile(), "utf8");

  // Truncate the file the way a crash mid-write would.
  writeFileSync(qcFile(), goodBytes.slice(0, Math.floor(goodBytes.length / 2)));

  const recovered = await readQcState(); // a plain READ — reachable from a customer link
  assert.ok(recovered.quotes.length > 0);

  const quarantined = readdirSync(DIR).filter((f) => f.startsWith("qc.json.corrupt-"));
  assert.ok(quarantined.length > 0, "damaged store must be preserved on disk for recovery");
  const preserved = await readFile(path.join(DIR, quarantined[0]!), "utf8");
  assert.ok(preserved.includes("Real Customer"), "the damaged file still holds the real data");
});

test("a damaged rfqs.json is quarantined, not replaced by the next submission", async () => {
  await saveRfq({ contact: { company: "First Co", name: "A", email: "a@x.com" }, items: [{ sku: "X", qty: 1 }], freight: false });
  await saveRfq({ contact: { company: "Second Co", name: "B", email: "b@x.com" }, items: [{ sku: "Y", qty: 2 }], freight: false });
  const goodBytes = await readFile(rfqFile(), "utf8");
  const damaged = goodBytes.slice(0, Math.floor(goodBytes.length / 2)); // truncated mid-write
  writeFileSync(rfqFile(), damaged);

  // An ordinary anonymous customer submission must not destroy the evidence.
  await saveRfq({ contact: { company: "Third Co", name: "C", email: "c@x.com" }, items: [{ sku: "Z", qty: 3 }], freight: false });

  const quarantined = readdirSync(DIR).filter((f) => f.startsWith("rfqs.json.corrupt-"));
  assert.ok(quarantined.length > 0, "damaged RFQ store must be preserved");
  const preserved = await readFile(path.join(DIR, quarantined[0]!), "utf8");
  assert.equal(preserved, damaged, "the damaged bytes are preserved byte-for-byte for recovery");
  assert.ok(preserved.includes("Second Co"), "earlier RFQ data is still recoverable");
  const live = await listRfqs();
  assert.equal(live.length, 1);
  assert.equal(live[0]!.contact.company, "Third Co");
});

/* --------------------------------------------- empty !== unseeded --------- */

test("an emptied segment stays empty instead of resurrecting demo data", async () => {
  await freshStore();
  await patchQcState({ quotes: [] });
  assert.equal((await readQcState()).quotes.length, 0, "deleting every quote must stick");

  // A later unrelated write must not bring the seed quotes back either.
  await patchQcState({ settings: { ...(await readQcState()).settings, rep: "J. Miller" } });
  assert.equal((await readQcState()).quotes.length, 0, "seed data must not reappear on a settings-only write");
});

test("a cleared equipment catalog stays cleared", async () => {
  await freshStore();
  await patchQcState({ catalog: [] });
  await patchQcState({ clients: [] });
  const s = await readQcState();
  assert.equal(s.catalog.length, 0, "demo machines must not come back after being deleted");
  assert.equal(s.clients.length, 0);
});

/* ------------------------------------------------------------ durability -- */

test("writes leave no orphaned temp files behind", async () => {
  await freshStore();
  await patchQcState({ settings: { ...(await readQcState()).settings, fob: "Sturgis, MI" } });
  const temps = readdirSync(DIR).filter((f) => f.includes(".tmp"));
  assert.equal(temps.length, 0);
});

test("mutateQuote bumps rev so later stale writes are detectable", async () => {
  const before = await freshStore();
  const id = before.quotes[0]!.id;
  const baseRev = before.quotes[0]!.rev ?? 0;
  const updated = await mutateQuote(id, (q) => ({ ...q, notes: "server-side change" }));
  assert.ok((updated!.rev ?? 0) > baseRev, "every server-side mutation advances rev");
});
