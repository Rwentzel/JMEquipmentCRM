import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPayment, usd2 } from "../src/lib/qc/logic";

const parse = (s: string) => Number(s.replace(/[$,]/g, ""));

test("instalments add up to the total for every cent value", () => {
  for (const schedule of [[0.3, 0.6, 0.1], [0.5, 0.5]]) {
    for (let cents = 0; cents < 100; cents++) {
      const total = 24999 + cents / 100;
      const parts = splitPayment(total, schedule);
      const printed = parts.map(usd2).reduce((t, s) => t + parse(s), 0);
      assert.equal(
        printed.toFixed(2),
        total.toFixed(2),
        `${schedule.join("/")} on ${usd2(total)} printed ${parts.map(usd2).join(" + ")}`,
      );
    }
  }
});

test("the case that was broken on the quote document", () => {
  // $24,999.04 printed $7,499.71 + $14,999.42 + $2,499.90 = $24,999.03.
  const parts = splitPayment(24999.04, [0.3, 0.6, 0.1]);
  assert.deepEqual(parts.map(usd2), ["$7,499.71", "$14,999.42", "$2,499.91"]);
  assert.equal(parts.reduce((a, b) => a + b, 0).toFixed(2), "24999.04");
});

test("whole-dollar totals split exactly, with no remainder to carry", () => {
  assert.deepEqual(splitPayment(100000, [0.3, 0.6, 0.1]), [30000, 60000, 10000]);
  assert.deepEqual(splitPayment(50000, [0.5, 0.5]), [25000, 25000]);
});

test("a zero or missing total produces zero instalments, not NaN", () => {
  assert.deepEqual(splitPayment(0, [0.5, 0.5]), [0, 0]);
  assert.deepEqual(splitPayment(NaN, [0.3, 0.6, 0.1]), [0, 0, 0]);
});

test("the remainder lands on the last instalment, never the first", () => {
  // The first payment is what a customer sends with the purchase order, so it
  // is the one that must match the percentage they agreed to.
  const [first] = splitPayment(24999.04, [0.3, 0.6, 0.1]);
  assert.equal(first, Math.round(2499904 * 0.3) / 100);
});
