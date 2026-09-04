/**
 * Reorder-by-reference — lets a returning customer reload the parts from a
 * previous request using the reference we gave them plus the email they
 * submitted it with.
 *
 * SECURITY MODEL: the reference alone is not a credential (it appears in
 * emails and printouts). Both the reference AND the exact submitting email
 * must match, and the response carries only public catalogue data — SKU,
 * quantity, configurator choice ids and their labels, and a drawing location
 * — never the stored contact block. Every one of those values is text from
 * our own catalogue and diagram data, already shipped to the browser, so the
 * response adds nothing a visitor could not read off the storefront. A miss
 * and a nonexistent reference return the identical answer, so references
 * cannot be enumerated.
 *
 * WHY THE IDS TRAVEL: a reorder used to return SKU and quantity only. A
 * customer who had ordered a core splitter at 460V with a 90-inch frame
 * reloaded it as the standard build, and a belt picked off a manual drawing
 * came back as a bare part number with no drawing location — the desk then
 * priced the wrong machine and lost the fit-confirmation context, on a
 * request that had both the first time round. The ids are what the client
 * can resend; the labels are for the customer to check what they are about
 * to send.
 */

import type { StoredRfq, StoredRfqOrigin } from "@/lib/rfqStore";

export const REF_RE = /^RFQ-[A-Z0-9]{8}$/;

export interface ReorderItem {
  sku: string;
  qty: number;
  /** Configurator choice ids, exactly as validated at intake. Absent on a plain part or a record stored before ids were kept. */
  options?: string[];
  /** The same choices as the labels the desk read — display only. */
  config?: string[];
  /** Drawing location ids, as validated at intake. */
  origin?: StoredRfqOrigin;
  /** The drawing location as text — display only. */
  source?: string;
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
    .map((it) => ({
      sku: it.sku,
      qty: Math.max(1, Math.min(999, Math.round(Number(it.qty)) || 1)),
      ...(it.optionIds?.length ? { options: [...it.optionIds] } : {}),
      ...(it.config?.length ? { config: [...it.config] } : {}),
      ...(it.origin ? { origin: { ...it.origin } } : {}),
      ...(it.source ? { source: it.source } : {}),
    }));
}
