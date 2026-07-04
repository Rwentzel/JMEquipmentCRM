/**
 * Pure RFQ validation — no framework, no I/O — so it can be unit-tested
 * directly and reused by the API route. Returns a result with an HTTP-ish
 * outcome but never echoes PII.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface QuoteContact {
  company?: unknown;
  name?: unknown;
  email?: unknown;
  website?: unknown; // honeypot
}

export interface QuoteItem {
  sku?: unknown;
  qty?: unknown;
}

export type QuoteOutcome =
  | { kind: "honeypot" } // pretend success, ignore
  | { kind: "invalid" } // 422 generic
  | { kind: "ok" };

/** Decide how to handle an RFQ submission. `validSkus` is the catalog allowlist. */
export function evaluateQuote(
  contact: QuoteContact,
  items: QuoteItem[],
  validSkus: ReadonlySet<string>,
): QuoteOutcome {
  if (String(contact.website ?? "").trim().length > 0) return { kind: "honeypot" };

  const company = String(contact.company ?? "").trim();
  const name = String(contact.name ?? "").trim();
  const email = String(contact.email ?? "").trim();

  const valid =
    company.length > 0 &&
    name.length > 0 &&
    EMAIL_RE.test(email) &&
    items.length > 0 &&
    items.every((it) => validSkus.has(String(it.sku ?? "")) && Number(it.qty) >= 1);

  return valid ? { kind: "ok" } : { kind: "invalid" };
}
