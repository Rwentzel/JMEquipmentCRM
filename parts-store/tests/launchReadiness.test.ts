import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isLive } from "../src/lib/launch";
import { formatRfqEmail, mailConfigured } from "../src/lib/mail";
import { rfqsToCsv } from "../src/lib/csv";
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

/* ---- csv ---- */

test("CSV escapes quotes/commas/newlines and round-trips the RFQ", () => {
  const csv = rfqsToCsv([rfq]);
  const [header, row] = csv.trim().split("\r\n");
  assert.ok(header!.startsWith("ref,created_at"));
  assert.ok(row!.includes('"Acme ""Paper"" Co, Inc."'), "quoted company field");
  assert.ok(row!.includes('"1 Mill Rd,\nSturgis MI"'), "newline field preserved");
  assert.ok(row!.includes("JME-VCS-0021 x4; JME-SHT-0004 x1"));
  assert.ok(row!.includes(",5,"), "total units");
  assert.equal(header!.split(",").length, 18);
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
