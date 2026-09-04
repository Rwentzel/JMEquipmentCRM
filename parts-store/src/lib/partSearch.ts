import type { Part } from "@/data/types";

/**
 * Catalogue search, the way customers actually type.
 *
 * The first version required the whole query to appear as one contiguous
 * substring. That found "bottom slitter" (adjacent words in the name) but not
 * "slitter bottom" or "belt slitter" — and a customer reading a part number
 * off a dataplate or an old invoice often drops the punctuation, so
 * "JMESHT0096" found nothing for JME-SHT-0096. Measured against the built
 * app before this existed: 0 rows for all three.
 *
 * Now every whitespace-separated token must appear somewhere in the part's
 * text (order-free AND), and a token also matches a SKU with its punctuation
 * removed. Ranking is unchanged and still lives with the results list.
 *
 * Deliberately no fuzzy matching: on a 2,223-part catalogue a typo-tolerant
 * match returns plausible-looking wrong parts, which on an RFQ is worse than
 * an empty list that sends the customer to the desk.
 */

/** Lowercased, punctuation-free form of a SKU: "JME-SHT-0096" → "jmesht0096". */
export function compactSku(sku: string): string {
  return sku.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Query → non-empty lowercase tokens. */
export function queryTokens(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * The searchable text of a part, built once per part per search.
 *
 * `cat` is the machine-family category every part carries ("Sheeter",
 * "Brakes") and the field the category rail filters on; `category` is the
 * fine-grained one only a handful of parts set ("Blades"). The haystack read
 * `category` but not `cat`, so on the 2,198 generated parts — 99% of the
 * catalogue, which carry `cat` and no `category` — the family was invisible to
 * the search box: "sheeter" found 4 of 1,930 sheeter parts, and "sheeter belt"
 * found none at all, though the rail groups every one of them under Sheeter.
 */
export function partHaystack(p: Pick<Part, "sku" | "name" | "cat" | "category" | "fitment" | "description" | "keywords">): string {
  return [p.sku, p.name, p.cat, p.category, p.fitment, p.description, ...(p.keywords ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * True when every token of the query is found — in the part's text, or as a
 * punctuation-free match against its SKU. An empty query matches everything.
 */
export function partMatches(
  p: Pick<Part, "sku" | "name" | "cat" | "category" | "fitment" | "description" | "keywords">,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return true;
  const hay = partHaystack(p);
  const sku = compactSku(p.sku);
  return tokens.every((t) => hay.includes(t) || sku.includes(compactSku(t)));
}

/**
 * Character ranges of `text` to highlight for a tokenised query: every
 * case-insensitive occurrence of every token, merged where they overlap or
 * touch, in document order. Pure, so the marking logic is tested without a
 * renderer.
 *
 * A token that matched only through the compacted SKU (e.g. "JMESHT0096"
 * against "JME-SHT-0096") has no literal substring to mark and is skipped —
 * the row is found, which is what matters.
 */
export function highlightRanges(text: string, tokens: string[]): Array<[number, number]> {
  const lower = text.toLowerCase();
  const hits: Array<[number, number]> = [];
  for (const t of tokens) {
    if (!t) continue;
    let from = 0;
    for (;;) {
      const at = lower.indexOf(t, from);
      if (at === -1) break;
      hits.push([at, at + t.length]);
      from = at + t.length;
    }
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of hits) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}
