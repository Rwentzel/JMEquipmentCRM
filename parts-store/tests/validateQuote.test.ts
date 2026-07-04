import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateQuote } from "../src/lib/validateQuote";

const skus = new Set(["JM108", "VCS-SK-12"]);
const good = { company: "Acme", name: "Pat", email: "pat@acme.com" };
const items = [{ sku: "JM108", qty: 2 }];

test("accepts a well-formed request", () => {
  assert.equal(evaluateQuote(good, items, skus).kind, "ok");
});

test("honeypot field short-circuits to ignored", () => {
  assert.equal(evaluateQuote({ ...good, website: "http://spam" }, items, skus).kind, "honeypot");
});

test("rejects missing company / name", () => {
  assert.equal(evaluateQuote({ ...good, company: "" }, items, skus).kind, "invalid");
  assert.equal(evaluateQuote({ ...good, name: "" }, items, skus).kind, "invalid");
});

test("rejects bad email", () => {
  assert.equal(evaluateQuote({ ...good, email: "nope" }, items, skus).kind, "invalid");
});

test("rejects empty item list", () => {
  assert.equal(evaluateQuote(good, [], skus).kind, "invalid");
});

test("rejects unknown SKU", () => {
  assert.equal(evaluateQuote(good, [{ sku: "NOPE", qty: 1 }], skus).kind, "invalid");
});

test("rejects qty < 1", () => {
  assert.equal(evaluateQuote(good, [{ sku: "JM108", qty: 0 }], skus).kind, "invalid");
});
