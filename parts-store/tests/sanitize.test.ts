import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBand, toPublicPart, toPublicMachine } from "../src/data/sanitize";
import type { Machine, Part } from "../src/data/types";

test("normalizeBand maps lead times / consult to Quote Required", () => {
  assert.equal(normalizeBand("2 Wk"), "Quote Required");
  assert.equal(normalizeBand("Consult"), "Quote Required");
  assert.equal(normalizeBand("10–12 Wk Build"), "Quote Required");
});

test("normalizeBand recognizes the allowed bands and aliases", () => {
  assert.equal(normalizeBand("In Stock"), "In Stock");
  assert.equal(normalizeBand("low"), "Limited Stock");
  assert.equal(normalizeBand("freight required"), "Freight Quote Required");
  assert.equal(normalizeBand("backordered"), "Backorder");
  assert.equal(normalizeBand("discontinued"), "Discontinued / Contact JM");
});

test("toPublicPart returns only allowlisted fields", () => {
  const p: Part = { sku: "X1", name: "Seal", cat: "Hydraulic", statusBand: "In Stock", action: "request-quote" };
  const pub = toPublicPart(p);
  assert.deepEqual(Object.keys(pub).sort(), ["action", "cat", "name", "sku", "statusBand"]);
});

test("toPublicPart throws if a forbidden internal field is present", () => {
  const dirty = { sku: "X1", name: "Seal", cat: "Hydraulic", statusBand: "In Stock", action: "request-quote", cost: 12.5 };
  assert.throws(() => toPublicPart(dirty as unknown as Part), /forbidden field "cost"/);
});

test("toPublicMachine drops any vendor/price leakage", () => {
  const dirty = {
    sku: "M1", name: "Splitter", family: "Core Splitter", tag: "consult", tagLabel: "Consult",
    statusBand: "Quote Required", action: "request-quote", photo: null, blurb: "x", specs: [],
    vendorName: "Secret Supplier Co",
  };
  assert.throws(() => toPublicMachine(dirty as unknown as Machine), /forbidden field "vendorName"/);
});
