import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Design-system ruling: never literal hex in markup. Colour comes from the
 * tokens in styles/tokens.css, so a palette change is one edit and the
 * contrast checks in tests/contrast.test.ts keep their meaning. This walks
 * every .tsx file and fails on a hex literal, with one exemption: the
 * theme-color metadata the browser reads, which cannot be a var().
 */
const ROOT = join(process.cwd(), "src");
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;
const EXEMPT_LINE = /themeColor:/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

test("no literal hex colours in markup — tokens only", () => {
  const hits: string[] = [];
  for (const file of walk(ROOT)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (EXEMPT_LINE.test(line)) return;
      const m = line.match(HEX);
      if (m) hits.push(`${file.replace(process.cwd() + "/", "")}:${i + 1} ${m.join(" ")}`);
    });
  }
  assert.deepEqual(hits, [], `hex literals in markup (use a token from styles/tokens.css):\n${hits.join("\n")}`);
});
