/**
 * Data-boundary scan of the build artifacts (BUILD_PROMPT.md, 2026-09-10:
 * "scan every build artifact for price/cost/vendor/margin/bin/quantity
 * language before deploy"). Pure: the CLI in scripts/scanArtifacts.ts walks
 * the prerendered pages and calls these.
 *
 * A page is read as a customer reads it: script and style blocks dropped
 * (the RSC payload's `$1` is a React reference, not a dollar), tags removed
 * with a boundary marker at each closing tag so a part name that ends in a
 * number never runs into the "In Stock" badge beside it. Plain English uses
 * of "cost" and "price" are allowed — the RFQ-first copy says "no prices are
 * published online" on purpose.
 */

export interface ScanPattern {
  name: string;
  re: RegExp;
}

export const PATTERNS: ScanPattern[] = [
  { name: "money amount", re: /(?:\$|USD\s?)\s?\d[\d,]*(?:\.\d{1,2})?(?![\w-])/i },
  { name: "price/cost qualifier", re: /\b(?:unit|list|dealer|sell|selling|our|net|wholesale|landed|cost)\s+(?:price|cost)s?\b/i },
  { name: "cost figure", re: /\bcosts?\s*(?::|=|\$|\d)/i },
  { name: "margin / markup", re: /\b(?:margin|margins|markup|mark-up)\b/i },
  { name: "vendor / supplier", re: /\b(?:vendor|vendors|supplier|suppliers)\b/i },
  { name: "bin location", re: /\bbin\s*(?:location|loc|#|no\.?)\b/i },
  { name: "on-hand quantity", re: /\b(?:on[- ]hand|qty\s*on\s*hand|quantity\s*on\s*hand|stock\s*(?:level|count|qty))\b/i },
  { name: "numeric stock figure", re: /\b\d+\s+(?:in stock|available|left in stock)\b|\bin stock:\s*\d/i },
  { name: "QuickBooks reference", re: /\bquick\s?books\b/i },
  // A purchasing rule with a quantity: "Min buy 10", "MOQ 4". Plain "no
  // minimum order" is the storefront's own policy line and is allowed.
  { name: "purchasing note", re: /\b(?:min(?:imum)?\.?\s*(?:buy|order|purchase)\s*(?:qty\.?|quantity)?\s*:?\s*\d|moq\b)/i },
];

/** Visible text of an HTML document: no scripts, no styles, no tags. */
export function visibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ")
    .replace(/<\/[a-z][a-z0-9]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Finding {
  name: string;
  match: string;
  context: string;
}

/** Findings in one page's visible text. */
export function scanText(text: string): Finding[] {
  const out: Finding[] = [];
  for (const { name, re } of PATTERNS) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      const start = Math.max(0, m.index - 50);
      out.push({ name, match: m[0], context: text.slice(start, m.index + m[0].length + 50) });
      if (out.length > 50) return out;
    }
  }
  return out;
}

/** Customer pages only: staff surfaces (/ops, /quotes, /q) have their own boundary check. */
export function isCustomerPage(rel: string): boolean {
  return !/^\/?(ops|quotes|q)(\/|\.html$)/.test(rel);
}
