import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptNumericDraft } from "../src/components/NumberInput";

/**
 * Types a string one character at a time the way the quote builder is used,
 * returning the text left in the field and the number the quote would store.
 */
function typeInto(chars: string, opts: { allowNegative?: boolean } = {}) {
  let draft = "";
  let value = 0;
  for (const ch of chars) {
    const next = acceptNumericDraft(draft + ch, opts);
    if (!next.accept) continue; // keystroke rejected, field unchanged
    draft += ch;
    value = next.value;
  }
  return { draft, value };
}

test("a decimal dollar amount survives being typed", () => {
  // The regression: 1500.50 typed into Base ($) was stored as 501500.
  assert.deepEqual(typeInto("1500.50"), { draft: "1500.50", value: 1500.5 });
});

test("the decimal point is not eaten mid-number", () => {
  assert.deepEqual(typeInto("1500."), { draft: "1500.", value: 1500 });
  assert.equal(typeInto("0.5").value, 0.5);
  assert.equal(typeInto(".5").value, 0.5);
});

test("a fractional tax rate types correctly", () => {
  assert.equal(typeInto("6.25").value, 6.25);
});

test("the field can be cleared instead of snapping back to zero", () => {
  const cleared = acceptNumericDraft("");
  assert.deepEqual(cleared, { accept: true, value: 0 });
});

test("letters and stray symbols are rejected without disturbing the number", () => {
  for (const junk of ["12a", "1,500", "1 500", "$1500", "1e5", "--5", "1.2.3"]) {
    assert.deepEqual(acceptNumericDraft(junk), { accept: false }, junk);
  }
});

test("typing junk mid-number leaves the good digits alone", () => {
  assert.deepEqual(typeInto("15a00"), { draft: "1500", value: 1500 });
});

test("negatives are rejected unless the field opts in", () => {
  assert.deepEqual(acceptNumericDraft("-5"), { accept: false });
  assert.deepEqual(acceptNumericDraft("-5", { allowNegative: true }), { accept: true, value: -5 });
});

test("a lone sign or point is held as draft and reported as zero", () => {
  assert.deepEqual(acceptNumericDraft("."), { accept: true, value: 0 });
  assert.deepEqual(acceptNumericDraft("-", { allowNegative: true }), { accept: true, value: 0 });
});

test("leading zeros are kept while typing rather than rewriting the field", () => {
  // Rewriting "05" to "5" mid-keystroke is what moved the caret and scrambled
  // the digits in the first place. The draft is the user's, not ours.
  assert.deepEqual(typeInto("0050"), { draft: "0050", value: 50 });
});

test("every prefix of a typed amount parses to a prefix of the amount", () => {
  let draft = "";
  for (const ch of "24999.99") {
    const next = acceptNumericDraft(draft + ch);
    assert.equal(next.accept, true, `rejected at "${draft + ch}"`);
    draft += ch;
    assert.equal(String(draft), draft);
  }
  assert.equal(Number(draft), 24999.99);
});

test("a percentage over 100 is only rejected on blur, not while typing", () => {
  // Typing "100" passes through "1" and "10"; clamping per keystroke would
  // make 100 impossible to reach from an empty field.
  assert.deepEqual(typeInto("100"), { draft: "100", value: 100 });
  assert.deepEqual(acceptNumericDraft("250"), { accept: true, value: 250 });
});

test("integer fields refuse a decimal point outright", () => {
  // Quantities are counts. "2.5 belts" is not a thing the desk can ship, and
  // silently flooring it would ship 2 when the customer asked for 3.
  assert.deepEqual(acceptNumericDraft("2.5", { integer: true }), { accept: false });
  assert.deepEqual(acceptNumericDraft(".", { integer: true }), { accept: false });
  assert.deepEqual(typeInto("25", { integer: true }), { draft: "25", value: 25 });
});

test("retyping a quantity replaces it instead of appending to it", () => {
  // With the old field, a customer with 12 in the box who selected all and
  // typed 25 ordered 125: clearing snapped the value back to "1" and the new
  // digits landed after it. Clearing must leave the field empty.
  const cleared = acceptNumericDraft("", { integer: true });
  assert.deepEqual(cleared, { accept: true, value: 0 });
  assert.deepEqual(typeInto("25", { integer: true }).draft, "25");
});
