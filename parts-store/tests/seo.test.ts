/**
 * SEO/accessibility guarantees that are easy to lose silently.
 *
 * Canonical URLs matter here because the root layout declares `canonical: "/"`
 * for the home page (a Client Component, so it cannot export metadata). Any
 * indexable page that forgets its own canonical would inherit "/" and tell
 * search engines it is a duplicate of the home page — invisible in review,
 * damaging once JME_LAUNCH=live.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "src", "app");
const read = (...p: string[]) => readFileSync(path.join(APP, ...p), "utf8");

/** Every indexable public page, and the canonical path it must declare. */
const INDEXABLE: [string, string][] = [
  ["freight/page.tsx", '"/freight"'],
  ["compare/page.tsx", '"/compare"'],
  ["terms/page.tsx", '"/terms"'],
  ["privacy/page.tsx", '"/privacy"'],
  ["parts/goodstrong/page.tsx", '"/parts/goodstrong"'],
  ["machine/[sku]/page.tsx", "`/machine/${machine.sku}`"],
  ["parts/goodstrong/[model]/page.tsx", "`/parts/goodstrong/${model.id}`"],
  ["parts/goodstrong/[model]/[section]/page.tsx", "`/parts/goodstrong/${model.id}/${section.id}`"],
];

for (const [file, expected] of INDEXABLE) {
  test(`${file} declares its own canonical`, () => {
    const src = read(...file.split("/"));
    assert.ok(src.includes("canonical"), `${file} has no canonical — it would inherit "/" from the layout`);
    assert.ok(src.includes(expected), `${file} canonical should be ${expected}`);
  });
}

test("the root layout supplies the home page canonical", () => {
  assert.match(read("layout.tsx"), /alternates:\s*\{\s*canonical:\s*"\/"\s*\}/);
});

test("every indexable page still honours the launch switch", () => {
  for (const [file] of INDEXABLE) {
    assert.ok(read(...file.split("/")).includes("pageRobots()"), `${file} must use pageRobots() so JME_LAUNCH gates it`);
  }
});

test("staff and customer-link surfaces are hard-coded noindex, never launch-gated", () => {
  // /ops declares it on its layout; the other two on the page itself.
  for (const file of ["ops/layout.tsx", "quotes/[[...view]]/page.tsx", "q/[id]/[token]/page.tsx"]) {
    const src = read(...file.split("/"));
    assert.match(src, /index:\s*false/, `${file} must be noindex regardless of JME_LAUNCH`);
    assert.ok(!src.includes("pageRobots()"), `${file} must NOT follow the launch switch`);
  }
});

test("robots.txt keeps crawlers off the staff consoles and customer quote links", () => {
  const src = read("robots.ts");
  for (const p of ["/ops", "/quotes", "/q/", "/api/"]) {
    assert.ok(src.includes(`"${p}"`), `robots.txt must disallow ${p}`);
  }
});
