import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isLive } from "../src/lib/launch";
import { formatQuoteAcceptedEmail, formatRfqEmail, mailConfigured } from "../src/lib/mail";
import { rfqsToCsv } from "../src/lib/csv";
import { catalog } from "../src/data/catalog";
import type { StoredRfq } from "../src/lib/rfqStore";

afterEach(() => {
  delete process.env.JME_LAUNCH;
  delete process.env.SMTP_HOST;
  delete process.env.RFQ_NOTIFY_TO;
});

const rfq: StoredRfq = {
  ref: "RFQ-ABCD1234",
  createdAt: "2026-07-08T12:00:00.000Z",
  updatedAt: "2026-07-08T12:00:00.000Z",
  status: "new",
  contact: {
    company: 'Acme "Paper" Co, Inc.',
    name: "Pat",
    lastName: "Lee",
    email: "pat@acme.com",
    phone: "555-0100",
    phoneExt: "12",
    serial: "SN-991",
    shipAddress: "1 Mill Rd,\nSturgis MI",
    billingSameAsShipping: false,
    billingAddress: "PO Box 9, Sturgis MI",
    wantsAccount: false,
  },
  items: [
    { sku: "JME-VCS-0021", qty: 4 },
    { sku: "JME-SHT-0004", qty: 1 },
  ],
  message: "Need before the 20th if possible.",
  freight: true,
};

/* ---- launch mode ---- */

test("launch mode is off unless JME_LAUNCH=live exactly", () => {
  assert.equal(isLive(), false);
  process.env.JME_LAUNCH = "true";
  assert.equal(isLive(), false);
  process.env.JME_LAUNCH = "live";
  assert.equal(isLive(), true);
});

/* ---- mail ---- */

test("mail is a no-op until SMTP_HOST and RFQ_NOTIFY_TO are both set", () => {
  assert.equal(mailConfigured(), false);
  process.env.SMTP_HOST = "smtp.example.com";
  assert.equal(mailConfigured(), false);
  process.env.RFQ_NOTIFY_TO = "parts@jmequipment.net";
  assert.equal(mailConfigured(), true);
});

test("desk notification carries every RFQ field and flags freight", () => {
  const { subject, text } = formatRfqEmail(rfq);
  assert.match(subject, /RFQ-ABCD1234/);
  assert.match(subject, /freight/);
  for (const needle of [
    "Acme \"Paper\" Co, Inc.", "Pat Lee", "pat@acme.com", "555-0100 ext. 12",
    "SN-991", "1 Mill Rd", "PO Box 9", "opted OUT",
    "JME-VCS-0021  × 4", "JME-SHT-0004  × 1", "Need before the 20th",
  ]) {
    assert.ok(text.includes(needle), `missing from email: ${needle}`);
  }
});

test("desk notification never invents pricing", () => {
  const { text } = formatRfqEmail(rfq);
  assert.doesNotMatch(text, /\$\s?\d|price|cost/i);
});

test("quote-acceptance notice carries the signature and never leaks cost/margin", () => {
  const { subject, text } = formatQuoteAcceptedEmail({
    number: "Q-26-0512-44",
    company: "Great Lakes Paper Co.",
    contact: "M. Holt",
    contactEmail: "mholt@greatlakespaper.com",
    machine: "Dual Rotary Sheeter (GMC-TC II 1650)",
    total: "$572,250",
    signedName: "Marcus Holt",
    signedDate: "Jul 24, 2026",
    rep: "J. Miller",
  });
  assert.match(subject, /^\[ACCEPTED\] Q-26-0512-44 — Great Lakes Paper Co\.$/);
  for (const needle of ["Marcus Holt", "Jul 24, 2026", "mholt@greatlakespaper.com", "$572,250", "J. Miller", "/quotes/pipeline"]) {
    assert.ok(text.includes(needle), `missing from acceptance email: ${needle}`);
  }
  assert.doesNotMatch(text, /margin|\bcost\b/i);
});

/* ---- csv ---- */

test("CSV escapes quotes/commas/newlines and round-trips the RFQ", () => {
  const csv = rfqsToCsv([rfq]);
  const [header, row] = csv.trim().split("\r\n");
  assert.ok(header!.startsWith("ref,created_at"));
  assert.ok(row!.includes('"Acme ""Paper"" Co, Inc."'), "quoted company field");
  assert.ok(row!.includes('"1 Mill Rd,\nSturgis MI"'), "newline field preserved");
  assert.ok(row!.includes("JME-VCS-0021 x4; JME-SHT-0004 x1"));
  assert.ok(row!.includes(",5,"), "total units");
  const cols = header!.split(",");
  assert.equal(cols.length, 19);
  assert.equal(cols.at(-1), "repeat_of", "new columns are appended, never inserted, so import mappings keyed by position survive");
});

test("CSV with no records is just the header", () => {
  const lines = rfqsToCsv([]).trim().split("\r\n");
  assert.equal(lines.length, 1);
});

test("pageRobots follows the launch switch (per-page robots override the layout)", async () => {
  const { pageRobots } = await import("../src/lib/launch");
  delete process.env.JME_LAUNCH;
  assert.deepEqual(pageRobots(), { index: false, follow: false });
  process.env.JME_LAUNCH = "live";
  assert.deepEqual(pageRobots(), { index: true, follow: true });
  delete process.env.JME_LAUNCH;
});

test("goodstrong diagram parts are orderable (quote allowlist regression)", async () => {
  const { goodstrongDiagramSkus } = await import("../src/data/goodstrong");
  const skus = goodstrongDiagramSkus();
  // Real belt part numbers from the GMC-TC 1600E factory catalogue.
  assert.ok(skus.includes("MC2HA041003"));
  assert.ok(skus.includes("1216-8YU-30"));
});

/* ---- desk email: actionable at a glance ---- */

test("RFQ email names each part, not just its SKU", () => {
  const sku = catalog.parts[0]!.sku;
  const { text } = formatRfqEmail({
    ref: "RFQ-NAMES01", createdAt: "2026-08-18T00:00:00.000Z", updatedAt: "2026-08-18T00:00:00.000Z",
    status: "new", freight: false,
    contact: { company: "Great Lakes Converting", name: "Dana", email: "dana@gl.com" },
    items: [{ sku, qty: 2 }],
  });
  assert.ok(text.includes(sku), "SKU still present");
  assert.ok(
    text.includes(catalog.parts[0]!.name),
    "the desk should not have to look up what a SKU is on every lead",
  );
});

test("RFQ email tolerates a SKU that is not in the public catalog", () => {
  // Goodstrong diagram parts are orderable but are not catalog.parts entries.
  const { text } = formatRfqEmail({
    ref: "RFQ-UNKNOWN1", createdAt: "2026-08-18T00:00:00.000Z", updatedAt: "2026-08-18T00:00:00.000Z",
    status: "new", freight: false,
    contact: { company: "X", name: "Y", email: "y@x.com" },
    items: [{ sku: "NOT-IN-CATALOG-999", qty: 1 }],
  });
  assert.match(text, /NOT-IN-CATALOG-999\s+× 1\s*$/m, "unknown SKUs print cleanly with no dangling separator");
});

test("RFQ email links the ops desk absolutely, and honours JME_PUBLIC_URL", () => {
  const previous = process.env.JME_PUBLIC_URL;
  process.env.JME_PUBLIC_URL = "https://staging.example.com/";
  try {
    const { text } = formatRfqEmail({
      ref: "RFQ-LINK0001", createdAt: "2026-08-18T00:00:00.000Z", updatedAt: "2026-08-18T00:00:00.000Z",
      status: "new", freight: false,
      contact: { company: "X", name: "Y", email: "y@x.com" },
      items: [{ sku: catalog.parts[0]!.sku, qty: 1 }],
    });
    // Trailing slash trimmed, so the link is never ".../ops" doubled up.
    assert.ok(text.includes("https://staging.example.com/ops"), text.split("\n").find((l) => l.includes("ops desk")));
  } finally {
    if (previous === undefined) delete process.env.JME_PUBLIC_URL;
    else process.env.JME_PUBLIC_URL = previous;
  }
});
