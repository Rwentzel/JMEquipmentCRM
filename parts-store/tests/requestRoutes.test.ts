import { test } from "node:test";
import assert from "node:assert/strict";
import { mailtoHref, requestListText, telHref, DESK_EMAIL } from "../src/lib/requestRoutes";

const items = [
  { sku: "JME-VCS-BLD-001", name: "Splitter Blade", qty: 2 },
  { sku: "GMC-1600E", name: "1600-E Sheeter", qty: 1, configLabel: "460V · 90 in frame" },
];

test("the email route carries the reference, every line, and no price language", () => {
  const text = requestListText(items, "RFQ-ABCD1234");
  assert.match(text, /^Quote request RFQ-ABCD1234/);
  assert.match(text, /JME-VCS-BLD-001 · Splitter Blade · qty 2/);
  assert.match(text, /GMC-1600E · 1600-E Sheeter · qty 1 · 460V · 90 in frame/);
  assert.doesNotMatch(text, /\$|price|cost|margin|vendor|bin\b/i);
});

test("the mailto is addressed to the desk and URL-encoded", () => {
  const href = mailtoHref(items, "RFQ-ABCD1234");
  assert.ok(href.startsWith(`mailto:${DESK_EMAIL}?subject=`));
  assert.ok(href.includes(encodeURIComponent("Quote request RFQ-ABCD1234")));
  assert.ok(!href.includes("\n"), "newlines must be encoded");
  assert.ok(href.includes("%0A"));
});

test("a long list is capped so the mailto stays inside client limits", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ sku: `JME-BRK-${String(i).padStart(4, "0")}`, name: "Part", qty: 1 }));
  const text = requestListText(many);
  assert.match(text, /\+ 40 more line\(s\)/);
  assert.ok(mailtoHref(many).length < 4000);
});

test("an empty list still produces a usable question-only email", () => {
  assert.match(requestListText([]), /question only/);
});

test("the call route is an E.164 tel link", () => {
  assert.equal(telHref(), "tel:+12696590093");
});

test("quantities are normalised to positive integers", () => {
  const text = requestListText([{ sku: "X", name: "Y", qty: 0 }, { sku: "Z", name: "W", qty: 2.7 }]);
  assert.match(text, /X · Y · qty 1/);
  assert.match(text, /Z · W · qty 2/);
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

test("the storefront wires the three routes and the honesty line, before and after sending", () => {
  const src = readFileSync(join(__dirname, "../src/app/page.tsx"), "utf8");
  assert.match(src, /mailtoHref\(items, reference\)/);
  assert.match(src, /href=\{telHref\(\)\}/);
  assert.match(src, /Nothing has left your browser yet/);
  assert.match(src, /sendFailed && \(/, "the failure state offers the routes with the entries kept");
  assert.match(src, /<RequestRoutes items=\{items\} reference=\{reference\} onPrint=\{onPrint\} after \/>/);
});

import { supportMailtoHref } from "../src/lib/requestRoutes";

test("the support 'Email it' route carries the reference and the typed fields, encoded", () => {
  const href = supportMailtoHref("Request a manual", "REQ-ABCD1234", [["Machine serial number", "SN-26218"], ["Machine model", "Goodstrong GMC-TC II 1650"]]);
  assert.ok(href.startsWith("mailto:parts@jmequipment.net?subject="));
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /\[REQ-ABCD1234\] Request a manual/);
  assert.match(decoded, /Reference: REQ-ABCD1234\n\nMachine serial number: SN-26218\nMachine model: Goodstrong GMC-TC II 1650/);
  assert.ok(!href.includes("\n"));
  const noRef = decodeURIComponent(supportMailtoHref("Contact sales", null, []));
  assert.match(noRef, /Request: Contact sales/);
});
