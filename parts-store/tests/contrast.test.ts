import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * WCAG AA contrast guard for the colour decisions in the design system.
 *
 * `scripts/a11y-audit.mjs` is the real audit, but it needs a browser and a
 * running server, so it cannot gate every push. These text/background pairs are
 * the ones that actually failed when the site was audited, and every one of
 * them is a plain token lookup — so they can be checked here, in the normal
 * test run, with no browser at all.
 *
 * If this fails, a palette edit has pushed real body text back under 4.5:1.
 * Fix the colour rather than the threshold: the numbers are the WCAG 2.1 AA
 * floor for normal-size text, not a preference.
 */

const STYLES = path.join(import.meta.dirname, "..", "src", "styles");
const tokens = readFileSync(path.join(STYLES, "tokens.css"), "utf8");
const storefront = readFileSync(path.join(STYLES, "storefront.css"), "utf8");

/** Read a `--name: #hex;` declaration out of a stylesheet. */
function token(css: string, name: string): string {
  const m = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css);
  assert.ok(m, `token --${name} not found (was it renamed? update this test with it)`);
  return m![1]!.toLowerCase();
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a! > b! ? [a!, b!] : [b!, a!];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL = 4.5;

test("contrast math matches the WCAG reference values", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
  assert.equal(Math.round(contrast("#ffffff", "#ffffff")), 1);
  // Spot value used when picking --jme-red-text; catches a broken formula.
  assert.ok(Math.abs(contrast("#c0413f", "#232220") - 3.08) < 0.02);
});

test("red type on the dark surface ramp meets AA on every dark surface", () => {
  const red = token(tokens, "jme-red-text");
  for (const surface of ["ink", "ink-2", "plate", "plate-hi"]) {
    const bg = token(tokens, surface);
    const ratio = contrast(red, bg);
    assert.ok(
      ratio >= AA_NORMAL,
      `--jme-red-text ${red} on --${surface} ${bg} is ${ratio.toFixed(2)}:1, below the ${AA_NORMAL}:1 AA floor`,
    );
  }
});

test("the fill-weight brand red is still too dark for body text — the reason --jme-red-text exists", () => {
  // Guards the split itself: if these ever converge, someone has quietly
  // reverted the fix and the audit would start failing again.
  assert.ok(contrast(token(tokens, "jme-red-bright"), token(tokens, "plate")) < AA_NORMAL);
});

test("the assistant button uses light-on-maroon, not dark-on-maroon", () => {
  const maroon = token(tokens, "jme-red");
  assert.ok(contrast(token(tokens, "paper"), maroon) >= AA_NORMAL, "--paper on the maroon accent must clear AA");
  assert.ok(contrast(token(tokens, "ink"), maroon) < AA_NORMAL, "--ink on maroon was the original failure (2.84:1)");
});

test("parts-catalog light surface: muted text and status badges meet AA on section and card", () => {
  const sectionBg = token(storefront, "cat-bg");
  const cardBg = token(storefront, "cat-card");
  const muted = token(storefront, "cat-mut");

  // Scoped badge colours, kept in step with the .ps-catalog overrides.
  const badges: Record<string, string> = {
    "muted text / eyebrow / default badge": muted,
    "badge--stock": "#187e4e",
    "badge--lead": "#886a00",
    "badge--info": "#3870b2",
    "badge--out": token(tokens, "jme-red-bright"),
  };

  for (const [label, fg] of Object.entries(badges)) {
    for (const [bgName, bg] of [["--cat-bg", sectionBg], ["--cat-card", cardBg]] as const) {
      const ratio = contrast(fg, bg);
      assert.ok(
        ratio >= AA_NORMAL,
        `${label} ${fg} on ${bgName} ${bg} is ${ratio.toFixed(2)}:1, below the ${AA_NORMAL}:1 AA floor`,
      );
    }
  }
});

test("the light-surface badge overrides are actually present in the catalog scope", () => {
  // A correct palette is no use if the scoped rules that apply it are deleted.
  for (const selector of [
    ".ps-catalog .jme-badge--stock",
    ".ps-catalog .jme-badge--lead",
    ".ps-catalog .jme-badge--info",
  ]) {
    assert.ok(storefront.includes(selector), `${selector} override is missing — badges will fall back to dark-ramp colours`);
  }
  assert.match(storefront, /\.ps-catalog \.jme-eyebrow,\s*\n\.ps-catalog \.jme-badge \{/);
});
