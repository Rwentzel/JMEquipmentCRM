import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateQuote } from "../src/lib/validateQuote";
import { configLines } from "../src/lib/rfqConfig";
import { details } from "../src/data/details";

/**
 * The route's resolveOptions() is a thin wrapper over configLines(), which the
 * quote conversion also reads to tell a standard build from a configured one.
 * This used to be a hand-written copy of the route's loop; testing the real
 * function instead means there is no second implementation left to drift.
 */
function resolveOptionsForTest(machineSku: string, raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return configLines(machineSku, raw.slice(0, 40).map((v) => String(v)));
}

const skus = new Set(["JM108", "VCS-SK-12"]);
const good = { company: "Acme", name: "Pat", email: "pat@acme.com", consent: true };
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

test("rejects missing consent", () => {
  assert.equal(evaluateQuote({ ...good, consent: false }, items, skus).kind, "invalid");
  assert.equal(evaluateQuote({ company: "Acme", name: "Pat", email: "pat@acme.com" }, items, skus).kind, "invalid");
});

test("message-only mode accepts an empty item list when a message is present", () => {
  assert.equal(
    evaluateQuote({ ...good, message: "Do you service Geo M. Martin stands?" }, [], skus, { messageOnly: true }).kind,
    "ok",
  );
});

test("message-only mode still rejects an empty message", () => {
  assert.equal(evaluateQuote({ ...good, message: "" }, [], skus, { messageOnly: true }).kind, "invalid");
});

/* ---- configurator selections must reach the desk ---- */

test("a configured machine carries its options through to the stored item", () => {
  // The bug this covers: the configurator showed "Power: 5 HP / 460V 3Ø,
  // Frame height: 90 in (16″ head)", said "Added to request", and then sent
  // the desk a bare JME-VCS12-75 — the standard 230V, 75-inch build. JM would
  // have quoted the wrong machine, and the SKU itself contradicts the choice.
  const machine = "JME-VCS12-75";
  const opts = details[machine]!.options;
  const power = opts.find((o) => o.id === "power")!;
  const nonDefault = power.choices[2]!; // 460V 3Ø

  const resolved = resolveOptionsForTest(machine, [nonDefault.sku]);
  assert.deepEqual(resolved, [`${power.label}: ${nonDefault.v}`]);
});

test("an option id the machine does not offer is dropped, not echoed", () => {
  // Choice ids come from the browser, so a crafted payload must not put
  // arbitrary text into the desk's email or its CSV export.
  assert.deepEqual(resolveOptionsForTest("JME-VCS12-75", ["=HYPERLINK(\"http://x\")"]), []);
  assert.deepEqual(resolveOptionsForTest("JME-VCS12-75", ["NOT-A-CHOICE"]), []);
});

test("a machine with no configurator, and the standard build, add nothing", () => {
  assert.deepEqual(resolveOptionsForTest("JME-VCS12-75", []), []);
  assert.deepEqual(resolveOptionsForTest("NO-SUCH-MACHINE", ["P4"]), []);
});

test("multiple choices in one option group are listed together", () => {
  const opts = details["JME-VCS12-75"]!.options;
  const check = opts.find((o) => o.type === "check");
  if (!check || check.choices.length < 2) return; // nothing multi-select to assert on
  const [a, b] = check.choices;
  const resolved = resolveOptionsForTest("JME-VCS12-75", [a!.sku, b!.sku]);
  assert.equal(resolved.length, 1);
  // Plain containment: choice text carries regex metacharacters of its own
  // (e.g. "Spare blade set (4)"), so building a pattern from it is a trap.
  assert.ok(resolved[0]!.startsWith(`${check.label}: `));
  assert.ok(resolved[0]!.includes(a!.v) && resolved[0]!.includes(b!.v));
});
