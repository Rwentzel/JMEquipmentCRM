/**
 * Reorder-by-reference, across the layers.
 *
 * The reorder endpoint returned SKU and quantity only, and intake stored the
 * resolved labels but not the ids that produced them. So a customer who had
 * ordered a core splitter at 460V with a 90-inch frame reloaded it as the
 * standard build, a belt picked off manual page 5-3 came back as a bare part
 * number with no drawing location, and the desk received the repeat with no
 * link to the request it repeated. Each layer was correct on its own; every
 * one of these was found by running the reorder against a live server and
 * reading what the desk actually got.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-reorder-seam-"));

import { matchReorder } from "../src/lib/reorder";
import { formatRfqEmail } from "../src/lib/mail";
import { rfqsToCsv } from "../src/lib/csv";
import { quoteFromRfq } from "../src/lib/qc/fromRfq";
import { qcDefaults, SEED_CATALOG } from "../src/lib/qc/data";
import type { StoredRfq } from "../src/lib/rfqStore";

const SRC = path.join(import.meta.dirname, "..", "src");

const first: StoredRfq = {
  ref: "RFQ-89FA831D",
  createdAt: "2026-09-04T13:20:00.000Z",
  updatedAt: "2026-09-04T13:20:00.000Z",
  status: "quoted",
  contact: { company: "Reorder Co", name: "Ada", email: "ada@reorder.example", phone: "555-0177" },
  items: [
    {
      sku: "1808-8YU-50",
      qty: 2,
      source: "Goodstrong 1600-E (GMC-TC 1600 E) · Driving (Timing) Belts · p.5-3 · #2",
      origin: { model: "1600e", section: "driving-belt", page: "5-3", bubble: 2 },
    },
    {
      sku: "JME-VCS12-75",
      qty: 1,
      config: ["Power: 5 HP / 460V 3Ø", "Frame height: 90 in (16″ head)", "Guarding: Light curtain"],
      optionIds: ["P4", "F90", "G2"],
    },
    { sku: "JME-VCS-BLD-001", qty: 8 },
  ],
  freight: true,
};

/* ---- the reorder hands back what the browser can resend ---- */

test("a reorder returns the validated ids and labels, not just SKU and quantity", () => {
  const items = matchReorder(first, "ada@reorder.example")!;
  assert.deepEqual(items[1], {
    sku: "JME-VCS12-75",
    qty: 1,
    options: ["P4", "F90", "G2"],
    config: ["Power: 5 HP / 460V 3Ø", "Frame height: 90 in (16″ head)", "Guarding: Light curtain"],
  });
  assert.deepEqual(items[0]!.origin, { model: "1600e", section: "driving-belt", page: "5-3", bubble: 2 });
  assert.match(items[0]!.source!, /p\.5-3 · #2/);
  // A plain part stays exactly as before — nothing optional is invented.
  assert.deepEqual(items[2], { sku: "JME-VCS-BLD-001", qty: 8 });
});

test("a reorder still carries nothing from the contact block", () => {
  const json = JSON.stringify(matchReorder(first, "ada@reorder.example"));
  for (const pii of ["Reorder Co", "Ada", "ada@reorder.example", "555-0177"]) {
    assert.ok(!json.includes(pii), `${pii} must not leave the server on a reorder`);
  }
});

test("a record stored before ids were kept returns its labels but no ids", () => {
  // The browser must be able to tell this apart from a plain part: labels
  // without ids means "show the customer what they had, and make them set it
  // again" rather than quietly submitting the standard build.
  const legacy: StoredRfq = {
    ...first,
    items: [{ sku: "JME-VCS12-75", qty: 1, config: ["Power: 5 HP / 460V 3Ø"] }],
  };
  const [line] = matchReorder(legacy, "ada@reorder.example")!;
  assert.deepEqual(line, { sku: "JME-VCS12-75", qty: 1, config: ["Power: 5 HP / 460V 3Ø"] });
  assert.equal(line!.options, undefined);
});

/* ---- intake keeps the ids, and only believes a verified repeat ---- */

test("intake stores the ids beside the labels, and verifies a claimed reorderOf", async () => {
  // Pinned to the handler source: route modules cannot be imported under
  // Next, and this exact class of fix has shipped inert before — the unit
  // tests passing while the running server stored labels only.
  const route = await readFile(path.join(SRC, "app", "api", "quote", "route.ts"), "utf8");
  assert.match(route, /optionIds/, "intake must persist the validated option ids");
  assert.match(route, /origin: located\.origin/, "intake must persist the validated drawing ids");
  assert.match(route, /verifiedReorderOf\(body\.reorderOf, contact\.email\)/, "a claimed reorderOf is checked against the submitting email");
  assert.match(route, /matchReorder\(prior, email\) \? ref : null/, "verification reuses the reorder endpoint's own rule");
  assert.match(route, /reorderOf: repeatOf/, "only the verified reference is stored");
});

test("the browser reloads names from the shared lookup and resends the ids", async () => {
  const page = await readFile(path.join(SRC, "app", "page.tsx"), "utf8");
  const block = page.slice(page.indexOf("const onReorderLoaded"), page.indexOf("setReorderOf(loaded.ref)"));
  assert.match(block, /buildSkuLookup\(catalog, goodstrongModels\)/, "names must come from the lookup that knows drawing parts");
  assert.match(block, /options: it\.options/, "the ids are what the server reads on submit");
  assert.match(block, /origin: it\.origin/, "the drawing location must travel back");
  assert.match(block, /configLabel/, "the customer must see the build they are about to send");
  assert.match(page, /reorderOf \? \{ reorderOf \} : \{\}/, "the submission names the request it repeats");
});

/* ---- what the desk sees ---- */

test("the desk email names a drawing part and states what the request repeats", () => {
  const repeat: StoredRfq = { ...first, ref: "RFQ-1CD9191C", reorderOf: "RFQ-89FA831D" };
  const { text } = formatRfqEmail(repeat);
  assert.match(text, /1808-8YU-50 {2}× 2 {2}— T2 — AC Motor to Drive Shaft Timing Belt/, "a bare part number told the desk nothing");
  assert.match(text, /^Repeat of: RFQ-89FA831D$/m);
});

test("a first order carries no repeat line", () => {
  assert.doesNotMatch(formatRfqEmail(first).text, /Repeat of/);
});

test("the CSV carries the repeat as its LAST column so nothing keyed by position moves", () => {
  const repeat: StoredRfq = { ...first, ref: "RFQ-1CD9191C", reorderOf: "RFQ-89FA831D" };
  const [header, row] = rfqsToCsv([repeat]).trim().split("\r\n");
  const cols = header!.split(",");
  assert.equal(cols[cols.length - 1], "repeat_of");
  assert.equal(cols.indexOf("freight"), 4, "existing columns keep their positions");
  assert.ok(row!.endsWith(",RFQ-89FA831D"));
});

test("the quote built from a repeat tells the rep to check the earlier price", () => {
  const repeat: StoredRfq = { ...first, ref: "RFQ-1CD9191C", reorderOf: "RFQ-89FA831D" };
  const q = quoteFromRfq(repeat, SEED_CATALOG, qcDefaults(), 0);
  assert.match(q.notes, /Repeat of RFQ-89FA831D/);
  assert.doesNotMatch(quoteFromRfq(first, SEED_CATALOG, qcDefaults(), 0).notes, /Repeat of/);
});
