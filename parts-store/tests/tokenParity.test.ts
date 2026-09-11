import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * The design system is shared: the handoff's token file
 * (wp-theme/jme-child/assets/css/tokens/colors.css) is the source for both
 * tracks, and styles/tokens.css is this app's copy. Every colour name the
 * two have in common must carry the same value, so a brand change lands in
 * one place and the WordPress theme and this app cannot drift apart.
 *
 * One deliberate exception, listed with its reason, is checked rather than
 * waved through.
 */
const HANDOFF = path.join(process.cwd(), "..", "design_handoff_jme_platform", "wp-theme", "jme-child", "assets", "css", "tokens", "colors.css");
const APP = path.join(process.cwd(), "src", "styles", "tokens.css");

function luminance(hex: string): number {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
  const ch = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}
function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function tokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)) out.set(m[1]!, m[2]!.toLowerCase());
  return out;
}

// Raised from the handoff's #8d887e so fine print on the darkest panels
// clears 4.5:1; lighter only, never darker.
const DELIBERATE = new Set(["paper-faint"]);

test("every colour token shared with the handoff design system carries the same value", () => {
  const theirs = tokens(readFileSync(HANDOFF, "utf8"));
  const ours = tokens(readFileSync(APP, "utf8"));
  const shared = [...theirs.keys()].filter((k) => ours.has(k));
  assert.ok(shared.length >= 30, `only ${shared.length} shared token names — did a file move?`);
  const drift = shared.filter((k) => !DELIBERATE.has(k) && theirs.get(k) !== ours.get(k)).map((k) => `--${k}: app ${ours.get(k)} vs handoff ${theirs.get(k)}`);
  assert.deepEqual(drift, [], `token drift from the handoff design system:\n${drift.join("\n")}`);
  for (const k of DELIBERATE) {
    assert.ok(theirs.has(k) && ours.has(k), `deliberate exception --${k} is not in both files`);
    assert.ok(contrast(ours.get(k)!, ours.get("ink-2")!) >= contrast(theirs.get(k)!, ours.get("ink-2")!), `--${k} deviates but does not improve contrast`);
  }
});
