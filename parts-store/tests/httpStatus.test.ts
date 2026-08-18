/**
 * Soft-404 regression.
 *
 * A root-level loading.tsx makes every route stream, which commits a 200
 * status before notFound() can run: a bad SKU, model or quote token returned
 * "Page not found" with HTTP 200. Search engines treat that as a soft 404 and
 * penalise it — on a site whose whole purpose is being findable, that matters.
 *
 * This asserts the structural cause rather than booting a server: no
 * loading.tsx may sit at the app root, and any segment that adds one must not
 * contain a page that calls notFound().
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "src", "app");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

test("no loading.tsx at the app root — it would soft-404 every dynamic page", () => {
  const files = readdirSync(APP);
  assert.ok(!files.includes("loading.tsx"), "src/app/loading.tsx makes every route stream and return 200 for notFound()");
});

test("no route segment mixes a loading.tsx with a page that calls notFound()", () => {
  const loadingDirs = walk(APP)
    .filter((f) => path.basename(f) === "loading.tsx")
    .map((f) => path.dirname(f));

  for (const dir of loadingDirs) {
    const pagesBelow = walk(dir).filter((f) => path.basename(f) === "page.tsx");
    for (const page of pagesBelow) {
      const src = readFileSync(page, "utf8");
      assert.ok(
        !/\bnotFound\s*\(/.test(src),
        `${path.relative(process.cwd(), page)} calls notFound() but streams under ${path.relative(process.cwd(), dir)}/loading.tsx — it would return 200 instead of 404`,
      );
    }
  }
});

/* --------------------------------------------------------------- print --- */

test("the customer quote prints on white paper, not the dark viewing stage", () => {
  // The quote page shows the document on a dark stage with a drop shadow.
  // That is screen furniture: printed with background graphics enabled it
  // frames every page in grey and burns toner. This is the sheet a customer
  // forwards to their purchasing department, so it must be plain white.
  const css = readFileSync(path.join(process.cwd(), "src", "styles", "qc.css"), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\[data-screen-label="Client Quote View"\]\s*\{[^}]*background:\s*#fff/);
  assert.match(print, /#jme-print-doc\s*\{[^}]*box-shadow:\s*none/);
  assert.match(print, /\[data-print-hide\]\s*\{\s*display:\s*none/);
  assert.match(print, /@page\s*\{\s*size:\s*Letter/);
});
