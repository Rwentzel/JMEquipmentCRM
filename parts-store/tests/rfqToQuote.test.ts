/**
 * RFQ → draft quote conversion.
 *
 * Exercises `quoteFromRfq` itself. This file used to mirror the route's mapping
 * in a local helper, which is how a fix passes its unit tests while being inert
 * in the running app: the copy and the route drift apart, and only the copy is
 * ever checked. What matters here is that nothing the customer asked for is
 * lost, mispriced, or mislabelled on the way into a document they will sign.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-rfq2q-"));

import { buildDoc } from "../src/lib/qc/logic";
import { quoteFromRfq } from "../src/lib/qc/fromRfq";
import { STOREFRONT_TO_QC, UNMAPPED } from "../src/lib/qc/machineFromRfq";
import { qcDefaults, SEED_CATALOG } from "../src/lib/qc/data";
import { PARTS_MASTER } from "../src/lib/qc/partsMaster";
import { catalog } from "../src/data/catalog";
import type { StoredRfq, StoredRfqItem } from "../src/lib/rfqStore";

const settings = qcDefaults();

function rfqWith(items: StoredRfqItem[], extra: Partial<StoredRfq> = {}): StoredRfq {
  return {
    ref: "RFQ-ABCD1234",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    status: "new",
    contact: { company: "Acme Container Corp.", name: "D.", lastName: "Reyes", email: "dreyes@acmecontainer.com" },
    items,
    freight: false,
    ...extra,
  };
}

const convert = (items: StoredRfqItem[], extra?: Partial<StoredRfq>) =>
  quoteFromRfq(rfqWith(items, extra), SEED_CATALOG, settings, 0);

/* ---- parts ---- */

test("known SKUs carry the master's name and price onto the quote", () => {
  const priced = PARTS_MASTER.find((p) => p.price > 0)!;
  const [line] = convert([{ sku: priced.sku, qty: 3 }]).parts;
  assert.equal(line!.name, priced.name);
  assert.equal(line!.price, priced.price);
  assert.equal(line!.qty, 3);
  assert.equal(line!.rfq, false);
});

test("an unknown SKU becomes a visible RFQ line rather than being dropped or quoted at $0", () => {
  const { parts } = convert([{ sku: "NOT-A-REAL-SKU", qty: 2 }]);
  assert.equal(parts.length, 1, "the customer's line item must survive the conversion");
  assert.equal(parts[0]!.rfq, true, "must read as pending a price, not as free");
  assert.equal(parts[0]!.price, 0);
});

test("quantities are never zero or negative", () => {
  const { parts } = convert([{ sku: "X", qty: 0 }, { sku: "Y", qty: -5 }]);
  assert.ok(parts.every((l) => l.qty >= 1));
});

test("a converted parts request produces a valid customer document with no machine", () => {
  const q = convert([{ sku: PARTS_MASTER.find((p) => p.price > 0)!.sku, qty: 2 }]);
  assert.equal(q.machineId, null, "a parts request is not an equipment quote");

  const doc = buildDoc(q, null, settings)!;
  assert.ok(doc, "a parts-only quote must still render a document");
  assert.equal(doc.client.company, "Acme Container Corp.");
  // Internal provenance must never reach the customer's copy.
  const json = JSON.stringify(doc);
  assert.ok(!json.includes("RFQ-ABCD1234"), "internal notes must not leak onto the client document");
  assert.ok(!json.toLowerCase().includes("margin"));
});

test("a single-line parts quote does not say \"1 line items\" on the customer's copy", () => {
  const q = convert([{ sku: PARTS_MASTER.find((p) => p.price > 0)!.sku, qty: 1 }]);
  assert.equal(buildDoc(q, null, settings)!.machineSubtitle, "1 line item");
  const two = convert([{ sku: "A", qty: 1 }, { sku: "B", qty: 1 }]);
  assert.equal(buildDoc(two, null, settings)!.machineSubtitle, "2 line items");
});

/* ---- what the customer asked for has to reach the quote they sign ---- */

test("a configured machine reaches the quote line as configured", () => {
  // Before this, the quote said "JME-VCS12-75" — the standard 230V, 75-inch
  // build — for a customer who chose 460V and a 90-inch frame, and that is the
  // document they are asked to sign.
  const cfg = ["Power: 5 HP / 460V 3Ø", "Frame height: 90 in (16″ head)"];
  const q = convert([{ sku: "JME-VCS12-75", qty: 1, config: cfg }]);
  const shown = JSON.stringify(buildDoc(q, SEED_CATALOG.find((m) => m.id === "vcs-12-75")!, settings));
  assert.match(shown, /460V/);
  assert.match(shown, /90 in/);
});

test("drawing provenance travels as desk context, not as part of the line", () => {
  // Where it was picked confirms fit; it is not part of what is being sold, so
  // it belongs in the notes rather than on the customer's line item.
  const source = "Goodstrong 1600-E · Driving (Timing) Belts · p.5-3 · #2";
  const q = convert([{ sku: "1808-8YU-50", qty: 2, source }]);
  assert.ok(!q.parts[0]!.name.includes("p.5-3"), "the line stays about the part itself");
  assert.match(q.notes, /1808-8YU-50 picked from Goodstrong 1600-E/);
});

/* ---- a machine request is an equipment quote, not a parts quote ---- */

test("a requested machine heads the document instead of being sold as replacement parts", () => {
  // A customer configured a core splitter on the storefront and the quote came
  // back titled "Parts Quotation / Replacement Parts & Components", with
  // parts-desk specs, a "Genuine" warranty and a "Same-Day" lead time.
  const q = convert([
    { sku: "JME-VCS12-75", qty: 1, config: ["Power: 5 HP / 460V 3Ø", "Frame height: 90 in (16″ head)"] },
  ]);
  assert.equal(q.machineId, "vcs-12-75");

  const machine = SEED_CATALOG.find((m) => m.id === "vcs-12-75")!;
  const doc = buildDoc(q, machine, settings)!;
  assert.equal(doc.kicker, "Quotation");
  assert.equal(doc.machineName, machine.name);
  assert.ok(!JSON.stringify(doc).includes("Replacement Parts & Components"));
  assert.equal(doc.pricing.warranty, machine.warranty);
  assert.equal(doc.pricing.leadTime, machine.lead);

  // …and the build the customer chose is still on the document.
  const shown = JSON.stringify([doc.machineSubtitle, doc.specs]);
  assert.match(shown, /460V/);
  assert.match(shown, /90 in/);
});

test("the machine's price is not assumed — the rep prices the build that was asked for", () => {
  // The catalogue base is the *default* build's. Carrying it across would quote
  // the standard 230V/75-inch splitter's price to someone who chose neither.
  const q = convert([{ sku: "JME-VCS12-75", qty: 1, config: ["Frame height: 90 in (16″ head)"] }]);
  assert.equal(q.base, 0);
  assert.equal(q.crating, 0);
  const doc = buildDoc(q, SEED_CATALOG.find((m) => m.id === "vcs-12-75")!, settings)!;
  assert.equal(doc.pricing.total, "By Consultation");
});

test("an unpriced request does not book a fabricated negative margin", () => {
  // blankQuote derives cost from its fallback machine, so every untouched
  // request used to arrive at the desk showing a −$12,600 margin.
  assert.equal(convert([{ sku: "JME-VCS12-75", qty: 1 }]).cost, 0);
  assert.equal(convert([{ sku: "NOT-A-REAL-SKU", qty: 1 }]).cost, 0);
});

test("ROI stays off until there is a price", () => {
  // buildDoc computes payback from the total. On an unpriced quote that renders
  // "0 mo" payback beside a five-year net, which reads as a guarantee.
  const q = convert([{ sku: "JME-VCS12-75", qty: 1 }]);
  assert.equal(q.roiOn, false);
  assert.equal(buildDoc(q, SEED_CATALOG.find((m) => m.id === "vcs-12-75")!, settings)!.roi.show, false);
});

test("the machine line is dropped only when the header already says everything it would", () => {
  const bare = convert([{ sku: "JME-VCS12-75", qty: 1 }]);
  assert.equal(bare.parts.length, 0, "a single machine line would just repeat the header and the spec table");

  const many = convert([{ sku: "JME-VCS12-75", qty: 2 }]);
  assert.equal(many.parts.length, 1, "a quantity the header cannot show has to stay visible");
  assert.equal(many.parts[0]!.qty, 2);
});

/* ---- the document must describe the build the customer asked for ---- */

const VCS = () => SEED_CATALOG.find((m) => m.id === "vcs-12-75")!;
const NON_STANDARD = ["Power: 5 HP / 460V 3Ø", "Frame height: 90 in (16″ head)", "Guarding: Light curtain"];

test("a non-standard build governs the specs instead of the catalogue's default build", () => {
  // With the catalogue entry heading the document unchanged, the spec table read
  // "Power: 5 HP / 230V / 1PH" and the subtitle read '12" Head · 75" Frame'
  // directly above a line item asking for 460V and 90 inches. A document that
  // contradicts itself and still looks right is worse than one titled wrongly.
  const q = convert([{ sku: "JME-VCS12-75", qty: 1, config: NON_STANDARD }]);
  const doc = buildDoc(q, VCS(), settings)!;

  const specs = new Map(doc.specs.map((s) => [s.k, s.v]));
  assert.equal(specs.get("Power"), "5 HP / 460V 3Ø", "the catalogue's 230V must not survive");
  assert.equal(specs.get("Frame height"), "90 in (16″ head)");
  assert.equal(specs.get("Guarding"), "Light curtain");
  assert.ok(!JSON.stringify(doc.specs).includes("230V"));
  assert.ok(!doc.specs.some((s) => s.k === "Core Head"), "cfg rows describe the default build, not this one");

  assert.match(doc.machineSubtitle, /460V/);
  assert.match(doc.machineSubtitle, /90 in/);
  assert.ok(!doc.machineSubtitle.includes('75"'));
});

test("catalogue specs the customer did not choose are still shown", () => {
  const doc = buildDoc(convert([{ sku: "JME-VCS12-75", qty: 1, config: NON_STANDARD }]), VCS(), settings)!;
  const keys = doc.specs.map((s) => s.k);
  assert.ok(keys.includes("Footprint"), "the request overrides what it names, not the whole table");
  assert.equal(new Set(keys).size, keys.length, "no spec is listed twice");
});

test("a standard build leaves the catalogue entry to speak for itself", () => {
  const standard = ["Power: 5 HP / 230V 1Ø", "Frame height: 75 in (12″ head)", "Guarding: Mesh cage + interlock"];
  const q = convert([{ sku: "JME-VCS12-75", qty: 1, config: standard }]);
  assert.equal(q.rfqBuild, undefined, "nothing departs from the catalogue, so nothing needs overriding");
  assert.equal(buildDoc(q, VCS(), settings)!.machineSubtitle, VCS().sub);
});

test("add-ons are line additions and do not make a build non-standard", () => {
  // A spare blade set changes nothing the catalogue entry asserts about the
  // machine, so it must not push the quote onto the override path.
  const standard = ["Power: 5 HP / 230V 1Ø", "Frame height: 75 in (12″ head)", "Guarding: Mesh cage + interlock"];
  const q = convert([{ sku: "JME-VCS12-75", qty: 1, config: [...standard, "Add-ons: Spare blade set (4)"] }]);
  assert.equal(q.rfqBuild, undefined);
});

test("the SKU on the document is the one the customer ordered from", () => {
  // resolvedSku fills the cfg template from q.config, which holds the Quote
  // Center's defaults — it would print JME-VCS12-75 for a 16-inch, 90-inch build.
  const q = convert([{ sku: "JME-VCS12-75", qty: 1, config: NON_STANDARD }]);
  assert.equal(buildDoc(q, VCS(), settings)!.sku, "JME-VCS12-75");
});

test("the requested build survives in the notes, for when the desk restates it", () => {
  // Choosing a machine in the builder clears rfqBuild — the desk is restating
  // the order — so the customer's own words have to be recorded somewhere the
  // rep can still read them.
  const q = convert([{ sku: "JME-GC-52", qty: 1, config: ["Backgauge: AC servo"] }]);
  assert.match(q.notes, /Requested build: Backgauge: AC servo/);
});

test("a machine request never renders as replacement parts", () => {
  for (const config of [undefined, NON_STANDARD]) {
    const q = convert([{ sku: "JME-VCS12-75", qty: 1, ...(config ? { config } : {}) }]);
    const doc = buildDoc(q, VCS(), settings)!;
    assert.equal(doc.kicker, "Quotation");
    assert.ok(!JSON.stringify(doc).includes("Replacement Parts & Components"));
  }
});

test("a machine with no Quote Center entry is still quoted as equipment, and says so loudly", () => {
  // Guessing one of three Datien cutter sizes would put a cut width the customer
  // never chose onto a document they sign — so no entry gets attached. The
  // document still has to describe the machine they asked for: it used to head
  // itself "Parts Quotation / Replacement Parts & Components" with a parts-desk
  // spec block, for a guillotine cutter.
  const q = convert([{ sku: "JME-GC-52", qty: 1, config: ["Backgauge: AC servo"] }]);
  assert.equal(q.machineId, null);
  assert.match(q.notes, /^SET THE MACHINE — JME-GC-52/);

  const doc = buildDoc(q, null, settings)!;
  assert.equal(doc.kicker, "Quotation");
  assert.equal(doc.machineName, catalog.machines.find((m) => m.sku === "JME-GC-52")!.name);
  assert.equal(doc.sku, "JME-GC-52");
  assert.ok(!JSON.stringify(doc).includes("Replacement Parts & Components"));
  assert.deepEqual(doc.specs, [{ k: "Backgauge", v: "AC servo" }]);
  // Taken as it comes, the machine's own catalogue specs stand in — a document
  // that names a machine and then says nothing about it is not a quotation.
  const asIs = buildDoc(convert([{ sku: "JME-GC-52", qty: 1 }]), null, settings)!;
  assert.deepEqual(asIs.specs, catalog.machines.find((m) => m.sku === "JME-GC-52")!.specs);
  // "Genuine" / "Same-Day" are the parts desk's terms, not a machine's.
  assert.equal(doc.pricing.warranty, "By Consultation");
  assert.equal(doc.pricing.leadTime, "By Consultation");
});

test("a parts request does not inherit a machine's warranty and lead time", () => {
  // blankQuote seeds both from its fallback machine, so a request for four
  // blades came back promising a 1-year warranty and a 10–12 week lead time.
  const doc = buildDoc(convert([{ sku: "JME-VCS-BLD-001", qty: 4 }]), null, settings)!;
  assert.equal(doc.kicker, "Parts Quotation");
  assert.equal(doc.pricing.warranty, "Per part");
  assert.equal(doc.pricing.leadTime, "Per line item");
  assert.ok(!JSON.stringify(doc.badges).includes("10–12 Weeks"));
});

test("extra machines are flagged rather than silently folded into one quotation", () => {
  const q = convert([
    { sku: "JME-VCS12-75", qty: 1 },
    { sku: "GMC-1600E", qty: 1 },
  ]);
  assert.equal(q.machineId, "vcs-12-75");
  assert.match(q.notes, /More than one machine requested/);
  assert.match(q.notes, /GMC-1600E/);
  assert.ok(
    q.parts.some((p) => p.sku === "GMC-1600E"),
    "the second machine stays on the quote so the rep can see it",
  );
});

test("parts requested alongside a machine keep their own names", () => {
  const priced = PARTS_MASTER.find((p) => p.price > 0)!;
  const q = convert([
    { sku: "JME-VCS12-75", qty: 1, config: ["Frame height: 90 in (16″ head)"] },
    { sku: priced.sku, qty: 4 },
  ]);
  const part = q.parts.find((p) => p.sku === priced.sku)!;
  assert.equal(part.name, priced.name);
  assert.equal(part.price, priced.price);
});

/* ---- the storefront ↔ Quote Center link cannot rot quietly ---- */

test("every storefront machine is either mapped or explicitly unmapped", () => {
  // Without this, a machine added to the storefront falls through to being
  // quoted as "Replacement Parts & Components" and nobody finds out until a
  // customer receives the document.
  const missing = catalog.machines
    .map((m) => m.sku)
    .filter((sku) => !(sku in STOREFRONT_TO_QC) && !(sku in UNMAPPED));
  assert.deepEqual(
    missing,
    [],
    "add each of these to STOREFRONT_TO_QC, or to UNMAPPED with the reason it has no single Quote Center entry",
  );
});

test("every mapped id exists in the Quote Center catalogue", () => {
  const dangling = Object.entries(STOREFRONT_TO_QC).filter(([, id]) => !SEED_CATALOG.some((m) => m.id === id));
  assert.deepEqual(dangling, [], "a renamed Quote Center machine leaves the map pointing at nothing");
});

test("the two tables never claim the same SKU", () => {
  const both = Object.keys(STOREFRONT_TO_QC).filter((sku) => sku in UNMAPPED);
  assert.deepEqual(both, []);
});
