/**
 * Reorder-by-reference — lets a returning customer reload the parts from a
 * previous request using the reference we gave them plus the email they
 * submitted it with.
 *
 * SECURITY MODEL: the reference alone is not a credential (it appears in
 * emails and printouts). Both the reference AND the exact submitting email
 * must match, and the response carries only public catalog data (SKU + qty)
 * — never the stored contact block. A miss and a nonexistent reference
 * return the identical answer, so references cannot be enumerated.
 */

import type { StoredRfq } from "@/lib/rfqStore";

export const REF_RE = /^RFQ-[A-Z0-9]{8}$/;

export interface ReorderItem {
  sku: string;
  qty: number;
}

export function normalizeRef(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return REF_RE.test(s) ? s : null;
}

export function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Items to reload, or null when the reference/email pair does not match. */
export function matchReorder(rfq: StoredRfq | null | undefined, email: unknown): ReorderItem[] | null {
  if (!rfq) return null;
  const given = normalizeEmail(email);
  if (!given || normalizeEmail(rfq.contact.email) !== given) return null;
  return rfq.items
    .filter((it) => typeof it.sku === "string" && it.sku.length > 0)
    .map((it) => ({ sku: it.sku, qty: Math.max(1, Math.min(999, Math.round(Number(it.qty)) || 1)) }));
}
