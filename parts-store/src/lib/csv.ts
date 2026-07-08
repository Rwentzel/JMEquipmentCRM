import type { StoredRfq } from "@/lib/rfqStore";

/**
 * RFQ book → CSV for the ops export (quoting, follow-up, QuickBooks entry).
 * Pure and unit-tested; the ops-authed export route streams this.
 */

/** RFC 4180 field escaping. */
function csvField(v: unknown): string {
  const s = String(v ?? "");
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
    r.items.map((it) => `${it.sku} x${it.qty}`).join("; "),
    r.items.reduce((n, it) => n + it.qty, 0),
    r.message ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
