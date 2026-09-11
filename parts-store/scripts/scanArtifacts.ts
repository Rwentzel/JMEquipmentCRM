/**
 * Customer-page data-boundary scan — CLI over the prerendered pages.
 *
 *   npm run scan:artifacts             # scans .next/server/app
 *   npm run scan:artifacts -- <dir>    # another output dir
 *
 * Exits 1 on any finding, and 2 when there is nothing to scan: a gate that
 * passes on an empty build directory is no gate (a failed build leaves one).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { isCustomerPage, scanText, visibleText } from "../src/lib/artifactScan";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

const root = path.resolve(process.argv[2] || ".next/server/app");
let files: string[] = [];
try {
  files = walk(root);
} catch {
  /* reported below */
}
const pages = files
  .map((f) => ({ f, rel: "/" + path.relative(root, f).split(path.sep).join("/") }))
  .filter((p) => isCustomerPage(p.rel));
if (pages.length === 0) {
  console.error(`FAIL  no prerendered customer pages under ${root} — run \`npm run build\` first (a failed build leaves none).`);
  process.exit(2);
}
let total = 0;
for (const { f, rel } of pages) {
  const findings = scanText(visibleText(readFileSync(f, "utf8")));
  if (findings.length) {
    total += findings.length;
    console.log(`\nFAIL  ${rel}`);
    for (const x of findings) console.log(`      ${x.name}: "${x.match}"  …${x.context}…`);
  }
}
if (total) {
  console.log(`\nFAIL  ${total} data-boundary finding(s) across ${pages.length} customer pages — see DATA_BOUNDARIES.md`);
  process.exit(1);
}
console.log(`PASS  ${pages.length} customer pages scanned — no price, cost, vendor, margin, bin, or quantity language.`);
