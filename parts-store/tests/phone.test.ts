import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhone } from "../src/lib/phone";

/**
 * The request form drives a controlled input, so formatPhone is fed its own
 * previous output on every keystroke. This helper reproduces that exactly:
 * take the current displayed value, append the next typed character, reformat.
 */
function typeInto(chars: string): string {
  let value = "";
  for (const ch of chars) value = formatPhone(value + ch);
  return value;
}

test("typing a 10-digit number keystroke by keystroke yields the number typed", () => {
  assert.equal(typeInto("2695550142"), "1-269-555-0142");
});

test("typing is idempotent — reformatting the displayed value never changes it", () => {
  let value = "";
  for (const ch of "2695550142") {
    value = formatPhone(value + ch);
    assert.equal(formatPhone(value), value, `unstable at "${value}"`);
  }
});

test("every prefix of a typed number is a prefix of the finished number", () => {
  // The regression dropped digits mid-way: 1-111-126-9555 for 2695550142.
  // Each intermediate value must stay consistent with what was typed so far.
  let value = "";
  let typed = "";
  for (const ch of "2695550142") {
    typed += ch;
    value = formatPhone(value + ch);
    assert.equal(value.replace(/\D/g, "").replace(/^1/, ""), typed);
  }
});

test("pasting formats in one pass, with or without the country code", () => {
  assert.equal(formatPhone("2695550142"), "1-269-555-0142");
  assert.equal(formatPhone("12695550142"), "1-269-555-0142");
  assert.equal(formatPhone("+1 (269) 555-0142"), "1-269-555-0142");
  assert.equal(formatPhone("269.555.0142"), "1-269-555-0142");
});

test("extra digits past ten are dropped, not folded into the number", () => {
  assert.equal(formatPhone("26955501429999"), "1-269-555-0142");
});

test("partial input formats progressively", () => {
  assert.equal(formatPhone("2"), "1-2");
  assert.equal(formatPhone("269"), "1-269");
  assert.equal(formatPhone("2695"), "1-269-5");
  assert.equal(formatPhone("269555"), "1-269-555");
  assert.equal(formatPhone("2695550"), "1-269-555-0");
});

test("clearing the field clears the value instead of stranding a lone prefix", () => {
  assert.equal(formatPhone(""), "");
  assert.equal(formatPhone("1-"), "");
  assert.equal(formatPhone("abc"), "");
});

test("backspacing walks back down the same values it walked up", () => {
  const forward: string[] = [];
  let value = "";
  for (const ch of "2695550142") {
    value = formatPhone(value + ch);
    forward.push(value);
  }
  for (let i = forward.length - 1; i > 0; i--) {
    const backspaced = formatPhone(forward[i].slice(0, -1));
    assert.equal(backspaced, forward[i - 1], `backspace from "${forward[i]}"`);
  }
});

test("tolerates null/undefined without throwing", () => {
  assert.equal(formatPhone(undefined as unknown as string), "");
  assert.equal(formatPhone(null as unknown as string), "");
});
