import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FAQ } from "../src/data/faq";

const src = readFileSync(join(__dirname, "../src/app/how-quoting-works/page.tsx"), "utf8");

test("the RFQ Flow page carries the four steps and both promise lists", () => {
  for (const t of ["Build your list", "Send it over", "We confirm and quote", "Approve and it ships"]) {
    assert.ok(src.includes(t), t);
  }
  assert.match(src, /What we ask for/);
  assert.match(src, /What we never do/);
  assert.match(src, /Ship a part we haven't confirmed fits/);
});

test("the FAQ accordion is fed from data/faq.ts, so the 2:30 PM cutoff is written once", () => {
  assert.match(src, /FAQ\.map\(/);
  assert.ok(FAQ.some((f) => /2:30 PM Eastern/.test(f.a)), "the ship cutoff lives in faq.ts");
  assert.ok(!/2:30/.test(src), "the page must not restate the cutoff");
});

test("no price language leaks into the explainer copy", () => {
  const copy = src.replace(/^import[^\n]*$/gm, "");
  assert.doesNotMatch(copy, /\$\s?\d|\bmargin\b|\bvendor\b|\bbin\b/i);
});
