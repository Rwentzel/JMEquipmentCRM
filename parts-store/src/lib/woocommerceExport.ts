/**
 * Track B, Stage A, from this app's catalogue.
 *
 * The handoff's export_woocommerce.py reads the QuickBooks-derived workbook
 * and writes the WooCommerce product CSV. That workbook is not in this
 * repository; the same full catalogue is (BUILD_PROMPT.md ruling 2: 2,223
 * parts, seven bands, nothing dropped for pricing). This builds the same
 * rows — same columns, same category paths, same RFQ-only flags — from
 * catalog.ts, so Track B can import from the one source of truth and the
 * handoff's own test_regression.py can gate the artifact.
 *
 * Pure: no I/O. The script in scripts/export-woocommerce.ts writes the file.
 */
import { catalog } from "@/data/catalog";
import type { Part } from "@/data/types";
import { deFormula } from "@/lib/csv";

export const WOO_COLUMNS = [
  "ID", "Type", "SKU", "Name", "Published", "Is featured?", "Visibility", "Short description",
  "Description", "Date sale price starts", "Date sale price ends", "Status", "Categories",
  "Tags", "Images", "Download limit", "Download expiration days", "Parent",
  "_jme_machine", "_jme_category", "_jme_type", "_jme_lead_time", "_jme_price_status", "_jme_fitment_status",
] as const;

export type WooRow = Record<(typeof WOO_COLUMNS)[number], string>;

export interface NameFix {
  original: string;
  replacement: string;
}

/** Words the split-scope validator refuses in any customer-facing field (G2). */
const CONFIDENTIAL = ["cost:", "margin", "wholesale", "vendor:", "oem:", "supplier"];

/**
 * The machine line a part belongs to, by SKU prefix — the catalogue's own
 * signal, since only the curated parts carry fitment text. Goodstrong and
 * Martin never share a path (G7).
 */
export function machineFor(p: Part): string {
  const prefix = p.sku.split("-").slice(0, 2).join("-");
  switch (prefix) {
    case "JME-SHT":
    case "JME-GMC":
      return "Goodstrong sheeter";
    case "JME-MRT":
      return "Martin rollstand";
    case "JME-VCS":
      return "JME core splitter";
    case "JME-DCL":
      return "JME decurler";
    default:
      return p.cat;
  }
}

function categoryPath(machine: string, category: string): string {
  const m = machine.toLowerCase();
  if (m.includes("goodstrong")) return `Machinery > Goodstrong > ${category}`;
  if (m.includes("martin")) return `Machinery > Martin > ${category}`;
  if (m.includes("jme")) return `Machinery > JME > ${category}`;
  return `Machinery > ${category}`;
}

export function applyNameFix(text: string, fixes: readonly NameFix[]): string {
  let out = text;
  for (const f of fixes) if (f.original && out.includes(f.original)) out = out.split(f.original).join(f.replacement);
  return out;
}

export interface WooExport {
  rows: WooRow[];
  /** SKU + field + pattern for anything the validator refused. Empty on a clean export. */
  violations: { sku: string; field: string; pattern: string }[];
  nameFixesApplied: number;
}

/** Every catalogue part as a WooCommerce row. Machines are quoted from their own pages, not listed as products. */
export function buildWooExport(fixes: readonly NameFix[] = [], parts: readonly Part[] = catalog.parts): WooExport {
  const rows: WooRow[] = [];
  const violations: WooExport["violations"] = [];
  let nameFixesApplied = 0;
  for (const p of parts) {
    const machine = machineFor(p);
    const category = p.category ?? p.cat;
    const fixed = applyNameFix(p.name, fixes);
    if (fixed !== p.name) nameFixesApplied++;
    const name = fixed || "[No Name]";
    const description = `Machine: ${machine}. Category: ${category}. Type: Part. Status: ${p.statusBand}`;
    const short = `SKU ${p.sku} for ${machine}`;
    for (const [field, value] of [["Name", name], ["Description", description], ["Short description", short]] as const) {
      const low = value.toLowerCase();
      for (const pat of CONFIDENTIAL) if (low.includes(pat)) violations.push({ sku: p.sku, field, pattern: pat });
    }
    rows.push({
      ID: "",
      Type: "simple",
      SKU: p.sku,
      Name: name,
      Published: "yes",
      "Is featured?": "no",
      Visibility: "visible",
      "Short description": short,
      Description: description,
      "Date sale price starts": "",
      "Date sale price ends": "",
      Status: "publish",
      Categories: categoryPath(machine, category),
      Tags: machine,
      Images: "",
      "Download limit": "",
      "Download expiration days": "",
      Parent: "",
      _jme_machine: machine,
      _jme_category: category,
      _jme_type: "Part",
      // The catalogue states availability as a band, never a date; the desk confirms lead time at quote.
      _jme_lead_time: "Contact",
      // G1: RFQ-first — every row is quote-only. HOLD rows would be flagged
      // "hold"; this catalogue carries none (the HOLD SKUs live in the
      // workbook the desk holds, not here).
      _jme_price_status: "quote_only",
      // Curated parts name the machine they fit; everything else is confirmed by the desk.
      _jme_fitment_status: p.fitment ? "auto" : "confirm",
    });
  }
  return { rows, violations, nameFixesApplied };
}

/** RFC 4180 CSV, with the same formula-neutralising the ops export uses. */
export function wooCsv(rows: readonly WooRow[]): string {
  const field = (v: string) => {
    const s = deFormula(v ?? "");
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [WOO_COLUMNS.join(",")];
  for (const r of rows) lines.push(WOO_COLUMNS.map((c) => field(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}
