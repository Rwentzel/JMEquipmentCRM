import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Point the store at a throwaway dir BEFORE importing it.
process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-support-test-"));

import { SUPPORT_FORMS, SUPPORT_KINDS, evaluateSupport, fieldErrors, isSupportKind } from "../src/lib/supportRequest";
import { formatRfqEmail } from "../src/lib/mail";
import { rfqsToCsv } from "../src/lib/csv";
import { getRfq, saveRfq, type StoredRfq } from "../src/lib/rfqStore";

const manual = {
  serial: " SN-26218 ",
  model: "Goodstrong GMC-TC II 1650",
  docType: "Operator manual",
  email: "maint@acme.test",
};

function ok(kind: string, fields: Record<string, unknown>) {
  const out = evaluateSupport(kind, fields, { consent: true });
  assert.equal(out.kind, "ok", `expected ok for ${kind}, got ${out.kind}`);
  return out.kind === "ok" ? out.request : (undefined as never);
}

test("every hub form has a spec with a way to reply and a required field", () => {
  for (const kind of SUPPORT_KINDS) {
    const form = SUPPORT_FORMS[kind];
    assert.equal(form.kind, kind);
    assert.ok(form.tag && form.label && form.title && form.submit && form.fine, `${kind} is missing copy`);
    assert.ok(form.fields.some((f) => f.required), `${kind} has no required field`);
    assert.ok(
      form.fields.some((f) => f.to === "email" || f.to === "phone"),
      `${kind} gives the desk no way to reply`,
    );
    // Keys are unique — a duplicate would silently drop an answer.
    assert.equal(new Set(form.fields.map((f) => f.key)).size, form.fields.length);
    for (const f of form.fields) if (f.type === "select") assert.ok(f.options && f.options.length > 0, `${kind}.${f.key} select has no options`);
  }
  assert.equal(isSupportKind("manual-request"), true);
  assert.equal(isSupportKind("quote"), false);
  assert.equal(isSupportKind(undefined), false);
});

test("a manual request routes the serial and email to the contact block and the selects to labelled details", () => {
  const r = ok("manual-request", manual);
  assert.equal(r.kind, "manual-request");
  assert.equal(r.contact.serial, "SN-26218");
  assert.equal(r.contact.email, "maint@acme.test");
  assert.deepEqual(r.details, {
    "Machine model": "Goodstrong GMC-TC II 1650",
    "What documentation do you need?": "Operator manual",
  });
  assert.equal(r.message, undefined);
});

test("a select answer outside our own option list is refused, not stored", () => {
  const out = evaluateSupport("manual-request", { ...manual, model: "Goodstrong 1650 <script>" }, { consent: true });
  assert.equal(out.kind, "invalid");
  const errs = fieldErrors(SUPPORT_FORMS["manual-request"], { ...manual, model: "anything else" });
  assert.match(errs.model!, /listed options/);
});

test("required fields, email shape, consent, honeypot and unknown kinds all gate intake", () => {
  assert.equal(evaluateSupport("manual-request", { ...manual, serial: "" }, { consent: true }).kind, "invalid");
  assert.equal(evaluateSupport("manual-request", { ...manual, email: "not-an-email" }, { consent: true }).kind, "invalid");
  assert.equal(evaluateSupport("manual-request", manual, { consent: false }).kind, "invalid");
  assert.equal(evaluateSupport("manual-request", manual, {}).kind, "invalid");
  assert.equal(evaluateSupport("manual-request", manual, { consent: true, website: "http://spam" }).kind, "honeypot");
  assert.equal(evaluateSupport("quote", manual, { consent: true }).kind, "invalid");
  assert.equal(evaluateSupport(42, manual, { consent: true }).kind, "invalid");
  // Optional selects may be left blank.
  assert.equal(evaluateSupport("manual-request", { ...manual, docType: "" }, { consent: true }).kind, "ok");
});

test("fieldErrors names the field in the form's own words and is empty for a sound form", () => {
  const errs = fieldErrors(SUPPORT_FORMS["service-request"], { name: "Pat" });
  assert.equal(errs.phone, "Phone is required.");
  assert.equal(errs.issue, "Describe the issue is required.");
  assert.equal(errs.name, undefined);
  assert.deepEqual(fieldErrors(SUPPORT_FORMS["manual-request"], manual), {});
});

test("a service request puts the symptom in the message and works with a phone number alone", () => {
  const r = ok("service-request", {
    name: "Pat Lee",
    phone: "269 555 0100",
    issue: "Pump noise at idle since Monday.\nReservoir looks low.",
    serviceType: "Diagnostic / troubleshooting",
  });
  assert.equal(r.contact.name, "Pat Lee");
  assert.equal(r.contact.email, "");
  assert.equal(r.contact.phone, "269 555 0100");
  assert.equal(r.message, "Pump noise at idle since Monday.\nReservoir looks low.");
  assert.deepEqual(r.details, { "Service type": "Diagnostic / troubleshooting" });
});

test("free text is trimmed and capped; a fitment check keeps the SKU as a detail line", () => {
  const long = "x".repeat(5000);
  const r = ok("fitment-check", { sku: "  MB2G2011011 ", machine: "SN-26218", context: long, email: "a@b.co" });
  assert.equal(r.details["Part SKU"], "MB2G2011011");
  assert.equal(r.message!.length, 4000);
});

function stored(overrides: Partial<StoredRfq>): StoredRfq {
  return {
    ref: "RFQ-TEST0001",
    createdAt: "2026-09-09T00:00:00Z",
    updatedAt: "2026-09-09T00:00:00Z",
    status: "new",
    freight: false,
    contact: { company: "", name: "", email: "" },
    items: [],
    ...overrides,
  };
}

test("the desk email names the form, lists the answers under our labels, and offers no reorder link", () => {
  const r = ok("manual-request", manual);
  const { subject, text } = formatRfqEmail(stored({ kind: r.kind, details: r.details, contact: r.contact }));
  assert.match(subject, /^\[MANUAL\] RFQ-TEST0001 — SN-26218$/);
  assert.match(text, /^New manual request RFQ-TEST0001/);
  assert.match(text, /\nSerial:   SN-26218\n/);
  assert.match(text, /\nDetails:\n  Machine model: Goodstrong GMC-TC II 1650\n  What documentation do you need\?: Operator manual\n/);
  assert.doesNotMatch(text, /reorder/i);
  assert.doesNotMatch(text, /Items:/);
});

test("a detail value cannot forge a contact line in the desk email", () => {
  const { text } = formatRfqEmail(
    stored({
      kind: "fitment-check",
      contact: { company: "Acme", name: "", email: "buyer@acme.test" },
      details: { "Part SKU": "X1\nEmail:    attacker@evil.test", "Machine serial or model": "SN-1" },
    }),
  );
  const emailLines = text.split("\n").filter((l) => /^Email:\s/.test(l));
  assert.equal(emailLines.length, 1);
  assert.match(emailLines[0]!, /buyer@acme\.test/);
});

test("a phone-only request says so instead of promising a reply address", () => {
  const { subject, text } = formatRfqEmail(
    stored({ kind: "service-request", contact: { company: "", name: "Pat", email: "", phone: "269 555 0100" }, message: "Noise." }),
  );
  assert.match(subject, /^\[SERVICE\] RFQ-TEST0001 — Pat$/);
  assert.doesNotMatch(text, /^Email:/m);
  assert.match(text, /phone number only/);
});

test("the CSV appends kind and details after every existing column", () => {
  const csv = rfqsToCsv([stored({ kind: "epc-lookup", details: { "Machine serial number": "SN-26218" }, contact: { company: "Acme", name: "", email: "a@b.co", serial: "SN-26218" } })]);
  const [header, row] = csv.trim().split("\r\n");
  assert.ok(header!.endsWith(",repeat_of,kind,details"), header);
  assert.ok(row!.endsWith(",epc-lookup,Machine serial number: SN-26218"), row);
  // Older records simply leave the new columns empty.
  const old = rfqsToCsv([stored({})]).trim().split("\r\n")[1]!;
  assert.ok(old.endsWith(",,,"), old);
});

test("the store keeps kind and details and leaves quote records untouched", async () => {
  const r = ok("sales-inquiry", { name: "Pat", email: "p@acme.test", topic: "Financing or leasing", message: "Two sheeters." });
  const saved = await saveRfq({ contact: r.contact, items: [], message: r.message, freight: false, kind: r.kind, details: r.details });
  const back = await getRfq(saved.ref);
  assert.equal(back?.kind, "sales-inquiry");
  assert.deepEqual(back?.details, { "What can we help with?": "Financing or leasing" });
  assert.equal(back?.message, "Two sheeters.");
  const plain = await saveRfq({ contact: { company: "Acme", name: "Pat", email: "p@acme.test" }, items: [{ sku: "JM108", qty: 1 }], freight: false });
  const plainBack = await getRfq(plain.ref);
  assert.equal("kind" in plainBack!, false);
  assert.equal("details" in plainBack!, false);
});
