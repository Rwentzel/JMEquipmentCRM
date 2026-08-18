/**
 * Storefront "Print summary" regressions.
 *
 * The request summary is a customer-facing document — people print it to hand
 * to purchasing, and they print it WITH background graphics so the JME header
 * comes through. Under those conditions the storefront's dark form styling
 * turns each textarea into a solid black rectangle with the customer's own
 * text lost inside it, and the floating assistant button lands on top of the
 * line items.
 *
 * Asserted against the stylesheet rather than a browser so it runs in the
 * normal suite; the rendering itself was verified in print emulation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.join(process.cwd(), "src", "styles", "print.css"), "utf8");
const printBlock = css.slice(css.indexOf("@media print"));

test("floating screen furniture never prints", () => {
  for (const sel of [".ps-askbtn", ".ps-ask", ".ps-totop", ".ps-tweaksbtn", ".ps-toastwrap"]) {
    assert.ok(printBlock.includes(sel), `${sel} must be hidden in print — it overlays the summary`);
  }
});

test("multi-line fields flatten to text instead of printing as black blocks", () => {
  assert.match(printBlock, /#request textarea/, "textareas need the same print reset as inputs");
  // The reset itself must clear the dark background, not just the border.
  const resetRule = printBlock.slice(printBlock.indexOf(".jme-input"));
  assert.match(resetRule.slice(0, 400), /background:\s*transparent\s*!important/);
  assert.match(resetRule.slice(0, 400), /color:\s*#1a1a1a\s*!important/);
});

test("checkboxes stay legible in one ink", () => {
  assert.match(printBlock, /#request input\[type="checkbox"\]/);
  assert.match(printBlock, /:checked::after/, "a ticked box must be distinguishable on paper");
});

test("the summary still prints on white with the request section visible", () => {
  assert.match(printBlock, /body\s*\{[^}]*background:\s*#fff\s*!important/);
  assert.match(printBlock, /\.ps-sec:not\(#request\)/, "everything except the request section is hidden");
});
