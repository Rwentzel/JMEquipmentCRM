import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTS_PUBLIC } from "../src/data/partsCatalog";
import { goodstrongDiagramSkus, goodstrongModels } from "../src/data/goodstrong";

/**
 * Data-boundary regression sweep over PUBLIC PART NAMES.
 *
 * The generated catalog once shipped a vendor part number and a cost inside
 * a description ("Tgw# 540062906-1 Tgw Cost- 121.90"). These patterns keep
 * that class of leak out of the client bundle permanently — the same rules
 * live in scripts/generate-public-catalog.py and the maintenance agent.
 */

const LEAK_PATTERNS: Array<[string, RegExp]> = [
  ["dollar amount", /\$\s?\d/],
  ["per-unit price value", /\b\d+\.\d{2}\s*\/\s*(?:ft|foot|ea|each|pc|set)\b/i],
  ["cost note", /\bcost\b/i],
  ["price note", /\bprice\b/i],
  ["margin/markup", /\b(margin|markup)\b/i],
  ["discount logic", /\bdiscount\b/i],
  ["wholesale reference", /\bwholesale\b/i],
  ["internal 'was part #' alias", /\bwas\s+part\s*#?/i],
  ["long vendor/OEM ref number", /\b\w*#\s*\d{5,}/],
  ["quickbooks reference", /\bquickbooks|qb\s*ref\b/i],
  ["bin location", /\bbin\s+[A-Z]?\d/i],
];

test("no public part name carries price, cost, vendor-ref, or internal-alias data", () => {
  const offenders: string[] = [];
  for (const p of PARTS_PUBLIC) {
    for (const [label, re] of LEAK_PATTERNS) {
      if (re.test(p.name)) offenders.push(`${p.sku} [${label}]: ${p.name}`);
    }
  }
  assert.deepEqual(offenders, [], `data-boundary leaks in public catalog:\n${offenders.join("\n")}`);
});

test("no public SKU deviates from the JME web-reference format", () => {
  for (const p of PARTS_PUBLIC) {
    assert.match(p.sku, /^JME-[A-Z]{3}-\d{4}$/, `unexpected sku format: ${p.sku}`);
  }
});

/* ---- the manual dataset gets the same sweep ---- */

/**
 * The Goodstrong manual data is transcribed by hand from a factory Part
 * Catalogue, and more pages are still to come. Hand transcription is exactly
 * where a stray cost note or supplier aside gets copied across, and until now
 * nothing checked this dataset at all — the boundary sweep covered the
 * generated parts catalogue only.
 *
 * The part numbers here are the machine manufacturer's own, printed in the
 * catalogue that ships with the machine, and the page says so. That is a
 * different thing from JME's sourcing, which is what the boundary protects.
 */
function goodstrongStrings(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  for (const model of goodstrongModels) {
    out.push({ where: `${model.id} label`, text: model.label });
    for (const section of model.sections) {
      out.push({ where: `${model.id}/${section.id} label`, text: section.label });
      for (const d of section.drawings ?? []) out.push({ where: `${model.id}/${section.id} drawing`, text: d.title });
    }
    for (const [sectionId, pages] of Object.entries(model.diagrams)) {
      for (const page of pages) {
        out.push({ where: `${model.id}/${sectionId} caption`, text: page.caption });
        for (const part of page.parts) {
          out.push({ where: `${model.id}/${sectionId} part ${part.sku}`, text: part.name });
          for (const alias of part.alsoKnownAs ?? []) {
            out.push({ where: `${model.id}/${sectionId} part ${part.sku} alias`, text: alias });
          }
        }
      }
    }
  }
  return out;
}

test("no manual-transcribed string carries price, cost, or JME sourcing data", () => {
  const offenders: string[] = [];
  for (const { where, text } of goodstrongStrings()) {
    for (const [label, re] of LEAK_PATTERNS) {
      if (re.test(text)) offenders.push(`${where} [${label}]: ${text}`);
    }
  }
  assert.deepEqual(offenders, [], `data-boundary leaks in the manual dataset:\n${offenders.join("\n")}`);
});

test("manual quantities are per-assembly counts, never warehouse stock", () => {
  // qty here means "this assembly uses 2 of these", which is public BOM data.
  // A stock count would be a boundary breach, so the shape is pinned: small,
  // positive, whole numbers.
  for (const model of goodstrongModels) {
    for (const [sectionId, pages] of Object.entries(model.diagrams)) {
      for (const page of pages) {
        for (const part of page.parts) {
          assert.ok(
            Number.isInteger(part.qty) && part.qty > 0 && part.qty <= 100,
            `${model.id}/${sectionId} ${part.sku} qty ${part.qty} does not look like a per-assembly count`,
          );
        }
      }
    }
  }
});

test("every diagram part is orderable through the quote API's allowlist", () => {
  // A part shown on a drawing that the quote endpoint would reject is a dead
  // end for the customer: they add it, and the request fails validation.
  const orderable = new Set(goodstrongDiagramSkus());
  for (const model of goodstrongModels) {
    for (const [sectionId, pages] of Object.entries(model.diagrams)) {
      for (const page of pages) {
        for (const part of page.parts) {
          assert.ok(orderable.has(part.sku), `${model.id}/${sectionId} shows ${part.sku}, which the quote API would reject`);
        }
      }
    }
  }
});

/* ---- a borrowed manual index must not pose as the customer's own ---- */

test("a model without its own catalogue declares whose page numbers it is showing", () => {
  // 1600 and 1650 reuse the 1600-E section index because the GMC-TC platform
  // shares a layout, but the page labels are the 1600-E book's. A customer
  // told to quote "page 5-3" from a manual that has no page 5-3 sends the desk
  // to the wrong drawing — the exact wrong-part risk the Terms disclaim.
  for (const model of goodstrongModels) {
    const ownDiagrams = Object.values(model.diagrams).some((pages) => pages.length > 0);
    if (ownDiagrams) continue;
    assert.ok(
      model.sectionsFrom && model.sectionsFrom !== model.id,
      `${model.id} shows a section index with page numbers but does not say which catalogue they came from`,
    );
    assert.ok(
      goodstrongModels.some((m) => m.id === model.sectionsFrom),
      `${model.id}.sectionsFrom points at "${model.sectionsFrom}", which is not a known model`,
    );
  }
});

test("a model with its own digitized drawings claims no borrowed index", () => {
  for (const model of goodstrongModels) {
    const ownDiagrams = Object.values(model.diagrams).some((pages) => pages.length > 0);
    if (!ownDiagrams) continue;
    assert.ok(
      !model.sectionsFrom || model.sectionsFrom === model.id,
      `${model.id} has its own drawings, so its page numbers must be its own`,
    );
  }
});
