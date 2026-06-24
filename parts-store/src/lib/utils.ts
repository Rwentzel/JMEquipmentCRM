/** Small shared helpers — no external dependencies. */

/** Join class names, dropping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Format a number as USD with two decimals. */
export function usd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

/** Resolve a photo filename to a public path; placeholder handling is per-component. */
export function asset(file: string): string {
  return "/images/" + file;
}

const PATH_LABELS: Record<string, string> = {
  "buy-now": "Buy Now",
  "request-quote": "Request Quote",
  call: "Call for Availability",
  "freight-quote": "Freight Quote Required",
  "quote-only": "Quote Only",
  backorder: "Backorder",
  discontinued: "Discontinued — Contact JM",
};

/** Human label for a purchase path. */
export function purchasePathLabel(path: string): string {
  return PATH_LABELS[path] ?? "Request Quote";
}
