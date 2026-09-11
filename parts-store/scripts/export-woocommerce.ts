/**
 * Track B, Stage A: write the WooCommerce product CSV from this app's
 * catalogue, plus the validation report the handoff's gates read.
 *
 *   npm run export:woocommerce                       # -> .data/track-b/products.csv
 *   npm run export:woocommerce -- --out /tmp/x.csv
 *
 * Then gate it with the handoff's own suite:
 *   python3 design_handoff_jme_platform/deploy/data/test_regression.py \
 *     --artifact parts-store/.data/track-b/products.csv \
 *     --expect-sku-count 2223 --expect-hold-count 0 \
 *     --allowlist design_handoff_jme_platform/deploy/data/redaction_allowlist.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildWooExport, wooCsv, type NameFix } from "../src/lib/woocommerceExport";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};
const out = opt("--out", path.join(process.cwd(), ".data", "track-b", "products.csv"));
const allowlistPath = opt(
  "--allowlist",
  path.join(process.cwd(), "..", "design_handoff_jme_platform", "deploy", "data", "redaction_allowlist.json"),
);

let fixes: NameFix[] = [];
try {
  const data = JSON.parse(readFileSync(allowlistPath, "utf8")) as { redactions?: NameFix[] } | NameFix[];
  const list = Array.isArray(data) ? data : (data.redactions ?? []);
  fixes = list.filter((e) => e && typeof e.original === "string" && typeof e.replacement === "string");
} catch {
  console.warn(`Allowlist not found at ${allowlistPath} — continuing without NAME_FIX.`);
}

const { rows, violations, nameFixesApplied } = buildWooExport(fixes);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, wooCsv(rows), "utf8");
writeFileSync(
  path.join(path.dirname(out), "validation_report.json"),
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      source: "parts-store/src/data/catalog.ts",
      rows: rows.length,
      hold_rows: 0,
      name_fixes_applied: nameFixesApplied,
      confidential_violations: violations,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
console.log(`Exported ${rows.length} products to ${out} (0 HOLD rows; ${nameFixesApplied} NAME_FIX substitutions)`);
if (violations.length) {
  console.error(`FAIL  ${violations.length} field(s) carry confidential wording — see validation_report.json`);
  process.exit(1);
}
console.log("PASS  no confidential wording in any exported field");
