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

/* ------------------------------------------------------- staff surfaces ---
 *
 * The Quote Center, the ops desk and the client quote document were audited
 * for the first time in #45/#47, which found 265 WCAG AA violations across
 * them. The corrections live in qc.css and ops.css as scoped colours rather
 * than palette edits, because these screens mix light panels with dark
 * controls. That makes them easy to lose in a later refactor and impossible
 * for the storefront's own guards to catch, so they get their own.
 */

const qc = readFileSync(path.join(STYLES, "qc.css"), "utf8");
const ops = readFileSync(path.join(STYLES, "ops.css"), "utf8");

/** Composite a colour drawn at `alpha` over a background, as the browser does. */
function over(fg: string, bg: string, alpha: number): string {
  const parse = (h: string) => {
    const s = h.replace("#", "");
    const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const [f, b] = [parse(fg), parse(bg)];
  return "#" + f.map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)).toString(16).padStart(2, "0")).join("");
}

test("Quote Center secondary text meets AA on both light panel surfaces", () => {
  // One grey for everything muted: on a light background there is no colour
  // that reads as fainter than secondary and still clears AA.
  const secondary = "#63636a";
  for (const surface of ["canvas", "canvas-tint"]) {
    const bg = token(tokens, surface);
    const ratio = contrast(secondary, bg);
    assert.ok(ratio >= AA_NORMAL, `QC secondary ${secondary} on --${surface} ${bg} is ${ratio.toFixed(2)}:1`);
  }
});

test("Quote Center status badges meet AA on the pipeline's white rows", () => {
  const badges: Record<string, string> = {
    "badge--stock": "#2f7a51",
    "badge--info": "#3470c9",
    "badge--lead": "#806509",
    "badge--out": "#a8353a",
  };
  for (const [label, fg] of Object.entries(badges)) {
    for (const surface of ["canvas", "canvas-tint"]) {
      const bg = token(tokens, surface);
      const ratio = contrast(fg, bg);
      assert.ok(ratio >= AA_NORMAL, `${label} ${fg} on --${surface} ${bg} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("the nav rail's 9-10px labels meet AA on the near-black rail", () => {
  const railText = "#838389";
  assert.ok(contrast(railText, token(tokens, "ink-2")) >= AA_NORMAL);
  // The rail footer's phone number is set at the element; same colour, and the
  // one line on that screen someone reads in order to dial it.
  assert.match(qc, /\.qc-sidefoot span \{ color: #838389; \}/);
  assert.ok(
    readFileSync(path.join(STYLES, "..", "components", "qc", "QuoteCenterApp.tsx"), "utf8").includes("#838389"),
    "the rail footer's contact line lost its corrected colour",
  );
});

test("ghost buttons are visible on the light panels they sit on", () => {
  // --paper on white is 1.2:1 — these were buttons you could only find by
  // hovering. Light panels get dark text; the dark cards keep the light text.
  assert.ok(contrast(token(tokens, "ink-text"), token(tokens, "canvas")) >= AA_NORMAL);
  assert.ok(contrast(token(tokens, "paper"), token(tokens, "plate")) >= AA_NORMAL);
  assert.match(qc, /\.qc-main \.jme-btn--ghost \{/);
  assert.match(qc, /\.qc-main \.jme-card \.jme-btn--ghost \{/);
  assert.match(qc, /\.qc-main \.jme-btn--on-dark \{/);
});

test("the ops desk's dimmed count chips survive their own opacity", () => {
  // The inactive chip is drawn at opacity .55, so the declared colour has to
  // be bright enough that what lands on screen still clears AA.
  const declared = "#e6e1d8";
  const chipBg = "#1c1c1b";
  const ratio = contrast(over(declared, chipBg, 0.55), chipBg);
  assert.ok(ratio >= AA_NORMAL, `ops count chip composites to ${ratio.toFixed(2)}:1`);
  assert.ok(ops.includes(declared), "the ops count chip lost its corrected colour");
});

test("the client quote document is readable on the body and on its dark blocks", () => {
  // This is the page a customer opens and prints. Its headings were 2.06:1.
  assert.ok(contrast("#63636a", token(tokens, "canvas")) >= AA_NORMAL);
  // The dark banner and ROI panel keep the light palette they were designed
  // with, which must itself still clear AA on charcoal.
  assert.ok(contrast(token(tokens, "paper-dim"), token(tokens, "jme-charcoal")) >= AA_NORMAL);
  // The ROI stat captions were the bright brand red on charcoal at 3.19:1.
  assert.ok(contrast("#cd6866", token(tokens, "jme-charcoal")) >= AA_NORMAL);
});

test("the document's dark blocks are matched on their background, not the variable name", () => {
  // Matching any mention of --jme-charcoal also caught the section headers,
  // which use it for a border-bottom, and left every heading unfixed. The
  // browser also reserialises inline styles with a space after the colon, so
  // both spellings have to be accepted or the rule misses on some pages.
  assert.match(qc, /\[style\*="background:var\(--jme-charcoal\)"\]/);
  assert.match(qc, /\[style\*="background: var\(--jme-charcoal\)"\]/);
  assert.ok(
    !/\[style\*="--jme-charcoal"\]/.test(qc),
    "the bare --jme-charcoal attribute match is back; it also catches the section header borders",
  );
});

test("the client document's ROI row reflows on a phone but not in print", () => {
  // Three 30px figures do not fit on a 390px screen — the third ran off the
  // edge, so the customer had to scroll sideways to finish their own quote.
  // Print keeps three columns, so the rule must stay screen-scoped.
  //
  // Matched inside a single rule body ([^}]*) on purpose: a pattern allowed to
  // run past a closing brace happily pairs this selector with some other
  // rule's declaration and passes when the reflow has been deleted.
  const reflow = /\[style\*="repeat\(3,1fr\)"\]\s*\{[^}]*grid-template-columns:\s*1fr 1fr/;
  const at = qc.search(reflow);
  assert.ok(at >= 0, "the ROI row no longer folds to two columns on a phone");

  const enclosing = qc.lastIndexOf("@media", at);
  assert.ok(enclosing >= 0, "the ROI reflow is not inside a media query — it would apply in print too");
  assert.match(
    qc.slice(enclosing, qc.indexOf("{", enclosing)),
    /screen/,
    "the ROI reflow is no longer screen-only; print needs all three columns",
  );
});
