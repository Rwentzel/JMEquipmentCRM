import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatQuoteAcceptedEmail, formatRfqEmail, notifyFrom } from "../src/lib/mail";
import type { StoredRfq } from "../src/lib/rfqStore";

function rfq(contact: Record<string, unknown>, message = ""): StoredRfq {
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

/** The `Key: value` lines the desk reads, in order. */
function keyLines(text: string): string[] {
  return text.split("\n").filter((l) => /^[A-Z][A-Za-z ]{0,9}:\s/.test(l));
}

test("a customer cannot forge a contact line in the desk's notification", () => {
  // The desk reads this top-down, so a forged Email line above the real one is
  // the address that gets replied to.
  const { text } = formatRfqEmail(
    rfq({ company: "Acme Converting\nEmail:    attacker@evil.test" }),
  );
  const emails = keyLines(text).filter((l) => l.startsWith("Email:"));
  assert.equal(emails.length, 1, `expected one Email line, got:\n${emails.join("\n")}`);
  assert.match(emails[0]!, /buyer@acme\.test/);
});

test("no customer-typed field can introduce a line of its own", () => {
  const fields = ["company", "name", "lastName", "phone", "phoneExt", "serial", "shipAddress"];
  for (const f of fields) {
    const { text } = formatRfqEmail(rfq({ [f]: "x\nSerial:   FORGED", billingSameAsShipping: true }));
    assert.doesNotMatch(text, /^Serial: {3}FORGED$/m, `${f} can forge a line`);
  }
});

test("the subject stays a single line", () => {
  const { subject } = formatRfqEmail(rfq({ company: "Acme\r\nBcc: victim@example.com" }));
  assert.doesNotMatch(subject, /[\r\n]/);
});

test("the customer's message survives intact, indented so it reads as a block", () => {
  const { text } = formatRfqEmail(rfq({}, "Need belts for a 1600-E.\nSecond line.\nThird."));
  assert.match(text, /Message:\n {2}Need belts for a 1600-E\.\n {2}Second line\.\n {2}Third\./);
});

test("a message cannot smuggle a key line past the indent", () => {
  const { text } = formatRfqEmail(rfq({}, "hello\nEmail:    attacker@evil.test"));
  assert.equal(keyLines(text).filter((l) => l.startsWith("Email:")).length, 1);
});

test("ordinary values are left exactly as typed", () => {
  const { text, subject } = formatRfqEmail(
    rfq({ company: "Acme Converting", phone: "1-269-555-0142", email: "buyer@acme.test" }),
  );
  assert.match(text, /^Company: {2}Acme Converting$/m);
  assert.match(text, /^Phone: {4}1-269-555-0142$/m);
  assert.equal(subject, "[RFQ] JME-0001 — Acme Converting");
});

test("From is never an SMTP username that is not an address", () => {
  // SendGrid's SMTP username is the literal string "apikey"; SES uses an
  // access-key id; Postmark a token. Passing one as From yields a message with
  // no From header at all and leaves the envelope sender as the customer's
  // address — the notification silently never arrives.
  const saved = { ...process.env };
  try {
    for (const user of ["apikey", "AKIAIOSFODNN7EXAMPLE", "b7a1-token-2f9c", ""]) {
      delete process.env.RFQ_NOTIFY_FROM;
      process.env.SMTP_USER = user;
      assert.match(notifyFrom(), /^[^\s@]+@[^\s@]+\.[^\s@]+$/, `SMTP_USER=${JSON.stringify(user)}`);
    }
  } finally {
    process.env = saved;
  }
});

test("an SMTP username that is an address is still honoured, and RFQ_NOTIFY_FROM wins", () => {
  const saved = { ...process.env };
  try {
    delete process.env.RFQ_NOTIFY_FROM;
    process.env.SMTP_USER = "parts@jmequipment.net";
    assert.equal(notifyFrom(), "parts@jmequipment.net");
    process.env.RFQ_NOTIFY_FROM = "quotes@jmequipment.net";
    assert.equal(notifyFrom(), "quotes@jmequipment.net");
  } finally {
    process.env = saved;
  }
});

/* ---- the acceptance notice must describe what was actually signed ---- */

test("the desk's acceptance notice names the machine, not the catalogue lookup", async () => {
  // It asked the Quote Center catalogue what was being quoted, so a signed
  // guillotine cutter with no entry attached reported "Parts / components" —
  // and this is the text the rep confirms deposit terms against. It must come
  // from the document the customer signed, which already resolves the machine
  // name, the ordered SKU and the requested build. Pinned to the handler
  // source: the same fix shipped once before with the unit tests passing and
  // the running server unchanged.
  const route = await readFile(
    path.join(import.meta.dirname, "..", "src", "app", "api", "qc", "shared", "[id]", "route.ts"),
    "utf8",
  );
  const line = route.split("\n").find((l) => l.trim().startsWith("machine:"));
  assert.ok(line, "the acceptance notice must still carry a machine line");
  assert.match(line, /doc\.machineName/, "must describe the signed document, not the catalogue entry");
  assert.match(line, /doc\.sku/, "the SKU the customer ordered, not the catalogue's default build");
  assert.ok(
    !/machine\s*\?/.test(line),
    'reading the catalogue entry reports "Parts / components" for a machine with no entry attached',
  );
});

test("the acceptance notice still carries no cost or margin", () => {
  const { subject, text } = formatQuoteAcceptedEmail({
    number: "Q-26-0818-09",
    company: "Mail Co",
    contact: "Sam",
    contactEmail: "sam@mail.example",
    machine: "Guillotine Cutter (JME-GC-52) — to 52 in · Programmable",
    total: "By Consultation",
    signedName: "Sam Rivera",
    signedDate: "Aug 18, 2026",
    rep: "J. Miller",
  });
  assert.match(subject, /\[ACCEPTED\] Q-26-0818-09/);
  assert.match(text, /Equipment: Guillotine Cutter \(JME-GC-52\)/);
  assert.ok(!/margin|Your Cost|\bcost\b/i.test(text), "the desk notice is quoted back in follow-ups");
});
