import { test } from "node:test";
import assert from "node:assert/strict";
import { isCustomerPage, scanText, visibleText } from "../src/lib/artifactScan";

const names = (t: string) => scanText(t).map((f) => f.name);

test("visible text drops scripts, styles and tags, and marks element boundaries", () => {
  const html = `<html><head><style>.a{margin:0}</style><script>self.__next_f.push([1,"$1 $L2 cost: 4"])</script></head>
    <body><h1>No prices are published online</h1><span>Min buy 10</span><span>In Stock</span></body></html>`;
  const text = visibleText(html);
  assert.doesNotMatch(text, /margin|\$1|cost: 4/, "script and style content must not be scanned");
  assert.match(text, /No prices are published online \| Min buy 10 \| In Stock \|/);
});

test("the RFQ-first copy is allowed; money, qualifiers, margin, vendor, bin, on-hand and purchasing notes are not", () => {
  assert.deepEqual(names("No prices are published online. Pricing and availability are provided by quotation. Cost of ownership drops. No minimum order · FOB Sturgis."), []);
  assert.deepEqual(names("Blade, $142.00 each"), ["money amount"]);
  assert.deepEqual(names("Blade — unit price on request"), ["price/cost qualifier"]);
  assert.deepEqual(names("Our margin on this line"), ["margin / markup"]);
  assert.deepEqual(names("Vendor: Apex Industrial"), ["vendor / supplier"]);
  assert.deepEqual(names("Bin location A-12"), ["bin location"]);
  assert.deepEqual(names("7 on hand"), ["on-hand quantity"]);
  assert.deepEqual(names("Only 3 in stock"), ["numeric stock figure"]);
  assert.deepEqual(names("24v light for push button Min buy 10"), ["purchasing note"]);
  assert.deepEqual(names("Anvil MOQ 4"), ["purchasing note"]);
  assert.deepEqual(names("Anvil Min buy Qty. 4"), ["purchasing note"]);
});

test("a number at the end of a name does not read as a stock figure across the badge boundary", () => {
  const text = visibleText("<span>Model 305 12\" (305mm) Rotor 12</span><span>In Stock</span>");
  assert.deepEqual(names(text), []);
});

test("staff routes are not customer pages", () => {
  assert.ok(isCustomerPage("/index.html") && isCustomerPage("/machine/JME-VCS12-75.html") && isCustomerPage("/_not-found.html"));
  assert.ok(!isCustomerPage("/ops.html") && !isCustomerPage("/quotes/pipeline.html") && !isCustomerPage("/q/abc/def.html"));
});
