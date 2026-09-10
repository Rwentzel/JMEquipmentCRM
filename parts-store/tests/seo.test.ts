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
  ["machines/page.tsx", '"/machines"'],
  ["support/page.tsx", '"/support"'],
  ["how-quoting-works/page.tsx", '"/how-quoting-works"'],
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

/**
 * The sitemap, the canonical list above and the a11y audit's route list are
 * three hand-kept lists of the same public pages. A page added to one and
 * forgotten in another is invisible in review; keep them in step.
 */
function quotedList(src: string, name: string): string[] {
  const m = src.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  assert.ok(m, `could not find ${name}`);
  return [...m![1]!.matchAll(/"([^"]*)"/g)].map((x) => x[1]!);
}

test("every static route in the sitemap is covered by the a11y audit", () => {
  const sitemap = readFileSync(path.join(process.cwd(), "src", "app", "sitemap.ts"), "utf8");
  const audit = readFileSync(path.join(process.cwd(), "scripts", "a11y-audit.mjs"), "utf8");
  const routes = quotedList(sitemap, "const staticRoutes").map((r) => r || "/");
  const audited = new Set(quotedList(audit, "const ROUTES"));
  for (const r of routes) assert.ok(audited.has(r), `${r} is in the sitemap but not in the a11y audit's ROUTES`);
});

test("every static indexable page is in the sitemap", () => {
  const sitemap = readFileSync(path.join(process.cwd(), "src", "app", "sitemap.ts"), "utf8");
  const routes = new Set(quotedList(sitemap, "const staticRoutes"));
  for (const [, canonical] of INDEXABLE) {
    if (!canonical.startsWith('"')) continue; // dynamic pages are generated from data
    const route = canonical.slice(1, -1);
    assert.ok(routes.has(route), `${route} declares a canonical but is missing from the sitemap`);
  }
});
