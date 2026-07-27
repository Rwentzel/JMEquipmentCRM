/**
 * Client-bundle data-boundary verifier.
 *
 * Next.js serves everything under .next/static without authentication, so a
 * chunk that belongs to an ops-gated page is still fetchable by anyone who
 * knows its URL. "It is only loaded by /quotes" is therefore not a control.
 * This script proves the dealer pricing and seeded customer records in
 * src/lib/qc/data.ts never reach a browser bundle at all.
 *
 * Forbidden values are derived from the seed data at runtime, not hardcoded,
 * so the check cannot drift as the catalog changes.
 *
 * Precision matters more than paranoia here: a verifier that cries wolf gets
 * switched off. Values are therefore split by how much a match actually
 * proves. Emails, phone numbers and large prices cannot collide with minified
 * output, so one hit is a violation. Small amounts like "2200" appear all over
 * minified JS as offsets and ids, and a fictional company name doubles as a
 * form placeholder in BuilderView, so those only count when several values
 * from the SAME seed record land in the SAME chunk — which is what an actual
 * leaked record looks like.
 *
 * Run after a production build:  npm run build && npm run verify:bundles
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { SEED_CATALOG, seedClients, seedQuotes } from "../src/lib/qc/data";

const CHUNK_DIR = path.join(process.cwd(), ".next", "static");
/** How many weak values from one record must co-occur before it counts. */
const CLUSTER_THRESHOLD = 3;

function jsFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return jsFiles(full);
    return e.isFile() && full.endsWith(".js") ? [full] : [];
  });
}

interface Needle {
  record: string;
  label: string;
  value: string;
  strong: boolean;
}

const needles: Needle[] = [];
const add = (record: string, label: string, raw: unknown, strong: boolean) => {
  const value = String(raw ?? "").trim();
  if (value.length < 4) return; // too short to mean anything in minified JS
  needles.push({ record, label, value, strong });
};

for (const m of SEED_CATALOG) {
  const rec = `catalog:${m.sku}`;
  // A five-figure machine price is distinctive; four-figure crating is not.
  add(rec, "base price", m.base, String(m.base ?? "").length >= 5);
  add(rec, "crating", m.crating, false);
  for (const opt of m.cfg?.options ?? []) add(rec, `addon "${opt.label}"`, opt.amount, false);
}
for (const c of seedClients()) {
  const rec = `client:${c.id}`;
  add(rec, "email", c.email, true);
  add(rec, "phone", c.phone, true);
  add(rec, "company", c.company, false); // also used as a UI placeholder
  add(rec, "contact", c.contact, false);
}
for (const q of seedQuotes()) {
  const rec = `quote:${q.number}`;
  add(rec, "quote number", q.number, true);
  add(rec, "base", q.base, String(q.base ?? "").length >= 5);
  add(rec, "cost", q.cost, String(q.cost ?? "").length >= 5);
}

const files = jsFiles(CHUNK_DIR);
if (files.length === 0) {
  console.error(`No client bundles found under ${CHUNK_DIR}. Run "npm run build" first.`);
  process.exit(1);
}

const violations: string[] = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(process.cwd(), file);
  const hits = needles.filter((n) => text.includes(n.value));

  for (const h of hits.filter((n) => n.strong)) {
    violations.push(`  ${rel}\n      ${h.record} ${h.label} = ${JSON.stringify(h.value)}`);
  }

  const byRecord = new Map<string, Needle[]>();
  for (const h of hits.filter((n) => !n.strong)) {
    byRecord.set(h.record, [...(byRecord.get(h.record) ?? []), h]);
  }
  for (const [record, group] of byRecord) {
    if (group.length >= CLUSTER_THRESHOLD) {
      violations.push(
        `  ${rel}\n      ${record} — ${group.length} values co-occur: ` +
          group.map((g) => `${g.label}=${JSON.stringify(g.value)}`).join(", "),
      );
    }
  }
}

if (violations.length > 0) {
  console.error(
    `DATA BOUNDARY VIOLATION — internal Quote Center data reached the client bundle:\n\n` +
      violations.join("\n") +
      `\n\nsrc/lib/qc/data.ts is server-only: it holds dealer pricing and customer records.\n` +
      `Import display constants from src/lib/qc/labels.ts, and keep prices, costs and client\n` +
      `details behind the ops-gated API.\n`,
  );
  process.exit(1);
}

console.log(
  `PASS  client bundles clean — ${needles.length} internal values ` +
    `(${needles.filter((n) => n.strong).length} high-confidence) checked across ${files.length} bundle files.`,
);
