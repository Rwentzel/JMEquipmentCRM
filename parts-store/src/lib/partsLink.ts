/**
 * Parts links.
 *
 * The storefront is reached from one link — in email signatures and on order
 * confirmations — and the desk often wants to hand a customer a pre-filled
 * request: the parts on a confirmation that came out of QuickBooks, a wear-kit
 * suggestion, the belts for the model on their dataplate. There are no
 * customer accounts (RFQ-first by policy), so the parts travel in the link:
 *
 *   https://parts.jmequipment.net/?parts=P12109:2,B1462:1
 *
 * The desk can type that by hand. On arrival the listed parts are added to
 * the request list and the customer lands on the form.
 *
 * This is deliberately separate from the reorder link (src/lib/reorder.ts,
 * ?reorder=RFQ-XXXXXXXX), which reloads a customer's OWN previous request and
 * therefore requires their reference and the email they used. A parts link
 * needs neither, because it never touches stored data.
 *
 * What the link carries is deliberately limited to SKUs and quantities:
 *
 *   - No customer identifier, so nothing to enumerate, leak or forge. A link
 *     forwarded to someone else gives them a pre-filled request list and
 *     nothing more.
 *   - Only SKUs in the public catalogue resolve. Names come from the catalogue,
 *     never from the URL, so a crafted link cannot put text of its own into
 *     the request the desk reads.
 *   - Quantities are clamped to the same 1–9999 the API enforces, the number
 *     of lines is capped, and the raw value is length-limited, so a hostile
 *     link cannot flood a browser's storage or the form.
 *
 * The parser is pure and lives here so it can be tested without a browser.
 */

export interface PartsLinkItem {
  sku: string;
  name: string;
  qty: number;
}

export interface PartsLinkResult {
  items: PartsLinkItem[];
  /** Entries that were not a known SKU, or fell past the line cap. */
  dropped: number;
}

/** Lowercased SKU → canonical SKU and display name. */
export type SkuLookup = Map<string, { sku: string; name: string }>;

interface Named { sku: string; name: string }
interface DiagramPartLike extends Named { alsoKnownAs?: string[] }
interface ModelLike { diagrams: Record<string, Array<{ parts: DiagramPartLike[] }>> }

/**
 * Everything a reorder link may name: the public catalogue, plus every part on
 * a Goodstrong diagram page. A diagram part's prior part numbers resolve too —
 * a customer reordering from a confirmation that predates a supersession
 * should still land on the current part, not a "not recognised".
 *
 * Later entries never overwrite earlier ones, so a catalogue SKU wins over a
 * diagram alias that happens to collide with it.
 */
export function buildSkuLookup(
  publicCatalog: { parts: Named[]; machines: Named[] },
  models: ModelLike[],
): SkuLookup {
  const lookup: SkuLookup = new Map();
  const put = (key: string, entry: Named) => {
    const k = key.trim().toLowerCase();
    if (k && !lookup.has(k)) lookup.set(k, entry);
  };
  for (const p of publicCatalog.parts) put(p.sku, { sku: p.sku, name: p.name });
  for (const m of publicCatalog.machines) put(m.sku, { sku: m.sku, name: m.name });
  for (const model of models) {
    for (const pages of Object.values(model.diagrams)) {
      for (const page of pages) {
        for (const part of page.parts) {
          const entry = { sku: part.sku, name: part.name };
          put(part.sku, entry);
          for (const alias of part.alsoKnownAs ?? []) put(alias, entry);
        }
      }
    }
  }
  return lookup;
}

export const PARTS_PARAM = "parts";
export const PARTS_MAX_LINES = 50;
export const PARTS_MAX_QTY = 9999;
const MAX_RAW_LENGTH = 4000;

/**
 * Parse a `parts` query value. Tolerant of what people type: spaces, a
 * trailing comma, missing quantity (→ 1), mixed case in the SKU. Strict about
 * what matters: unknown SKUs are dropped rather than passed through.
 */
export function parsePartsParam(raw: string | null | undefined, lookup: SkuLookup): PartsLinkResult {
  const text = String(raw ?? "").slice(0, MAX_RAW_LENGTH);
  const merged = new Map<string, PartsLinkItem>();
  let dropped = 0;

  for (const entry of text.split(",")) {
    const piece = entry.trim();
    if (!piece) continue;

    // Quantity is whatever follows the LAST colon, so a SKU may itself contain
    // one. A missing or unparsable quantity means one of the part.
    const at = piece.lastIndexOf(":");
    const skuText = (at >= 0 ? piece.slice(0, at) : piece).trim();
    const qtyText = at >= 0 ? piece.slice(at + 1).trim() : "";

    const hit = lookup.get(skuText.toLowerCase());
    if (!hit) {
      dropped++;
      continue;
    }

    const parsed = Number.parseInt(qtyText, 10);
    const qty = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, PARTS_MAX_QTY) : 1;

    const existing = merged.get(hit.sku);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, PARTS_MAX_QTY);
    } else if (merged.size >= PARTS_MAX_LINES) {
      dropped++;
    } else {
      merged.set(hit.sku, { sku: hit.sku, name: hit.name, qty });
    }
  }

  return { items: [...merged.values()], dropped };
}

/**
 * Build a parts link. The value is URL-encoded as a whole so SKUs that carry
 * `/` (several Goodstrong part numbers do) survive intact; browsers decode it
 * before the app sees it, and the parser accepts either form.
 */
export function buildPartsLink(base: string, items: Array<{ sku: string; qty: number }>): string {
  const value = items
    .filter((i) => i.sku && i.qty >= 1)
    .map((i) => `${i.sku}:${Math.min(Math.floor(i.qty), PARTS_MAX_QTY)}`)
    .join(",");
  return `${base.replace(/\/+$/, "")}/?${PARTS_PARAM}=${encodeURIComponent(value)}`;
}
