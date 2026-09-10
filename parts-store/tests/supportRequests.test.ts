import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSupportRequest, supportDetailLines, isSupportType, SUPPORT_TYPES } from "../src/lib/supportRequests";
import { formatRfqEmail } from "../src/lib/mail";
import { rfqsToCsv } from "../src/lib/csv";
import type { StoredRfq } from "../src/lib/rfqStore";

const ok = { consent: true };

test("a manual request needs a serial, a listed model and an email", () => {
  const good = evaluateSupportRequest("manual-request", { ...ok, email: "a@b.co", serial: "SN-26218" }, { machineModel: "Goodstrong GMC-TC II 1650", docType: "Service manual" });
  assert.equal(good.kind, "ok");
  assert.deepEqual(good.kind === "ok" && good.fields, { machineModel: "Goodstrong GMC-TC II 1650", docType: "Service manual" });
  assert.equal(evaluateSupportRequest("manual-request", { ...ok, email: "a@b.co" }, { machineModel: "Goodstrong GMC-TC II 1650" }).kind, "invalid", "no serial");
  assert.equal(evaluateSupportRequest("manual-request", { ...ok, email: "a@b.co", serial: "x" }, {}).kind, "invalid", "no model");
  assert.equal(evaluateSupportRequest("manual-request", { ...ok, email: "not-an-email", serial: "x" }, { machineModel: "Goodstrong GMC-TC II 1650" }).kind, "invalid");
});

test("a select value that is not on our list is rejected, never passed on", () => {
  const r = evaluateSupportRequest("manual-request", { ...ok, email: "a@b.co", serial: "x" }, { machineModel: "=HYPERLINK(\"http://evil\")" });
  assert.equal(r.kind, "invalid");
  const t = evaluateSupportRequest("sales-inquiry", { ...ok, name: "Pat", email: "a@b.co" }, { topic: "Something else entirely" });
  assert.equal(t.kind, "invalid");
});

test("a service request needs a person, a phone and a description; email is optional", () => {
  assert.equal(evaluateSupportRequest("service-request", { ...ok, name: "Pat", phone: "269", message: "pump noise" }, { serviceType: "Repair or component replacement" }).kind, "ok");
  assert.equal(evaluateSupportRequest("service-request", { ...ok, name: "Pat", message: "pump noise" }, {}).kind, "invalid", "no phone");
  assert.equal(evaluateSupportRequest("service-request", { ...ok, name: "Pat", phone: "269" }, {}).kind, "invalid", "no issue");
});

test("a fitment check needs a part and either a serial or a model", () => {
  assert.equal(evaluateSupportRequest("fitment-check", { ...ok, email: "a@b.co", serial: "SN-1" }, { partNumber: "JME-GMC-BLD-001" }).kind, "ok");
  assert.equal(evaluateSupportRequest("fitment-check", { ...ok, email: "a@b.co" }, { partNumber: "JME-GMC-BLD-001", machineModel: "Goodstrong 1650" }).kind, "ok");
  assert.equal(evaluateSupportRequest("fitment-check", { ...ok, email: "a@b.co" }, { partNumber: "JME-GMC-BLD-001" }).kind, "invalid", "neither serial nor model");
  assert.equal(evaluateSupportRequest("fitment-check", { ...ok, email: "a@b.co", serial: "SN-1" }, {}).kind, "invalid", "no part");
});

test("an EPC lookup needs serial and email; sales needs name, email and a listed topic", () => {
  assert.equal(evaluateSupportRequest("epc-lookup", { ...ok, email: "a@b.co", serial: "26218" }, {}).kind, "ok");
  assert.equal(evaluateSupportRequest("epc-lookup", { ...ok, serial: "26218", phone: "269" }, {}).kind, "invalid", "email required");
  assert.equal(evaluateSupportRequest("sales-inquiry", { ...ok, name: "Pat", email: "a@b.co" }, { topic: "Financing or leasing" }).kind, "ok");
  assert.equal(evaluateSupportRequest("sales-inquiry", { ...ok, name: "Pat", email: "a@b.co" }, {}).kind, "invalid", "topic required");
});

test("honeypot and missing consent are caught for every type", () => {
  for (const t of SUPPORT_TYPES) {
    assert.equal(evaluateSupportRequest(t, { ...ok, website: "spam", email: "a@b.co", name: "x", phone: "1", serial: "s", message: "m" }, { machineModel: "Other / not sure", partNumber: "p", topic: "Other" }).kind, "honeypot", t);
    assert.equal(evaluateSupportRequest(t, { email: "a@b.co", name: "x", phone: "1", serial: "s", message: "m" }, { machineModel: "Other / not sure", partNumber: "p", topic: "Other" }).kind, "invalid", t + " consent");
  }
  assert.ok(!isSupportType("parts-rfq") && !isSupportType("") && isSupportType("epc-lookup"));
});

const req: StoredRfq = {
  ref: "REQ-ABCD1234",
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
  status: "new",
  contact: { company: "", name: "", email: "riley@example.com", serial: "SN-26218" },
  items: [],
  freight: false,
  requestType: "manual-request",
  fields: { machineModel: "Goodstrong GMC-TC II 1650", docType: "Parts list & diagram" },
};

test("the desk email names the request kind, lists the typed details, and carries no reorder link", () => {
  const { subject, text } = formatRfqEmail(req);
  assert.equal(subject, "[MANUAL] REQ-ABCD1234 — Manual / documentation request — riley@example.com");
  assert.match(text, /^New manual \/ documentation request REQ-ABCD1234/);
  assert.match(text, /Details:\n  Machine model: Goodstrong GMC-TC II 1650\n  Documentation requested: Parts list & diagram/);
  assert.match(text, /Serial:   SN-26218/);
  assert.doesNotMatch(text, /reorder=/, "a support request is not reorderable");
  assert.doesNotMatch(text, /question only/);
  assert.doesNotMatch(text, /opted OUT/);
  assert.match(text, /Work this request in the ops desk/);
});

test("the CSV appends request_type and request_details last, and a parts RFQ reads parts-rfq", () => {
  const csv = rfqsToCsv([req, { ...req, ref: "RFQ-1", requestType: undefined, fields: undefined, items: [{ sku: "X", qty: 1 }] }]);
  const [header, row1, row2] = csv.split("\r\n");
  const cols = header!.split(",");
  assert.equal(cols[cols.length - 2], "request_type");
  assert.equal(cols[cols.length - 1], "request_details");
  assert.match(row1!, /,same as shipping,,,0,,,manual-request,/, "wants_account is blank: the question was never asked");
  assert.match(row1!, /,manual-request,Machine model: Goodstrong GMC-TC II 1650; Documentation requested: Parts list & diagram$/);
  assert.match(row2!, /,parts-rfq,$/);
});

test("detail lines follow the spec's field order and skip blanks", () => {
  assert.deepEqual(supportDetailLines("fitment-check", { machineModel: "1650", partNumber: "P-1" }), ["Part / SKU: P-1", "Machine serial or model: 1650"]);
  assert.deepEqual(supportDetailLines("epc-lookup", {}), []);
});
