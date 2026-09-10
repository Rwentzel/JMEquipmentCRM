import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stepQty } from "../src/components/QtyStepper";

test("stepping never leaves the allowed range", () => {
  assert.equal(stepQty(1, -1), 1, "minus at the minimum stays put");
  assert.equal(stepQty(1, 1), 2);
  assert.equal(stepQty(9999, 1), 9999, "plus at the cap stays put");
  assert.equal(stepQty(0, 0), 1, "a typed 0 settles on the minimum");
  assert.equal(stepQty(2.7, 0), 2, "a typed fraction is a whole quantity");
  assert.equal(stepQty(Number.NaN, 1), 2, "an unparseable draft steps from the minimum");
});

test("the request list uses the stepper with full-size controls", () => {
  const page = readFileSync(join(__dirname, "../src/app/page.tsx"), "utf8");
  assert.match(page, /<QtyStepper value=\{i\.qty\} label=\{i\.sku\} onChange=\{\(n\) => onQty\(i\.sku, n\)\} \/>/);
  const css = readFileSync(join(__dirname, "../src/styles/storefront.css"), "utf8");
  assert.match(css, /\.ps-stepper__btn \{[^}]*width: 44px;[^}]*min-height: 44px;/s);
  const cmp = readFileSync(join(__dirname, "../src/components/QtyStepper.tsx"), "utf8");
  assert.match(cmp, /aria-label=\{`Decrease quantity for \$\{label\}`\}/);
  assert.match(cmp, /aria-label=\{`Increase quantity for \$\{label\}`\}/);
});
