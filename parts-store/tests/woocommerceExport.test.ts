import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/data/catalog";
import { WOO_COLUMNS, buildWooExport, machineFor, wooCsv } from "../src/lib/woocommerceExport";

test("the Track B export carries every catalogue part, all quote-only, none blank", () => {
  const { rows, violations } = buildWooExport();
  assert.equal(rows.length, catalog.parts.length);
  assert.equal(new Set(rows.map((r) => r.SKU)).size, rows.length, "duplicate SKU");
  for (const r of rows) {
    assert.ok(r.Name.trim(), `${r.SKU} has a blank name`);
    assert.equal(r._jme_price_status, "quote_only");
    assert.equal(r.Type, "simple");
    assert.equal(r.Status, "publish");
  }
  assert.deepEqual(violations, []);
});

test("Goodstrong and Martin never share a category path, and the JME lines are their own", () => {
  const { rows } = buildWooExport();
  for (const r of rows) {
    const c = r.Categories.toLowerCase();
    assert.ok(!(c.includes("goodstrong") && c.includes("martin")), `${r.SKU}: ${r.Categories}`);
  }
  assert.equal(machineFor(catalog.parts.find((p) => p.sku.startsWith("JME-MRT-"))!), "Martin rollstand");
  assert.equal(machineFor(catalog.parts.find((p) => p.sku.startsWith("JME-SHT-"))!), "Goodstrong sheeter");
  assert.equal(machineFor(catalog.parts.find((p) => p.sku.startsWith("JME-VCS-"))!), "JME core splitter");
});

test("NAME_FIX substitutions apply and the validator refuses confidential wording", () => {
  const part = { ...catalog.parts[0]!, name: "Bearing from Apex Industrial Supply, Cost: $2,450" };
  const fixed = buildWooExport([{ original: "Apex Industrial Supply", replacement: "[Supplier A]" }], [part]);
  assert.match(fixed.rows[0]!.Name, /\[Supplier A\]/);
  assert.equal(fixed.nameFixesApplied, 1);
  assert.ok(fixed.violations.some((v) => v.pattern === "cost:"), "cost wording must be flagged");
});

test("the CSV has the handoff's columns in its order and neutralises formulas", () => {
  const csv = wooCsv(buildWooExport([], [{ ...catalog.parts[0]!, name: "=HYPERLINK(evil)" }]).rows);
  const [header, row] = csv.split("\r\n");
  assert.equal(header, WOO_COLUMNS.join(","));
  assert.ok(!/,=HYPERLINK/.test(row!), "a leading = must not survive into a spreadsheet cell");
});
