import type { RequestItem } from "@/data/types";

/**
 * The three off-line routes for a request list: email, call, print.
 *
 * These exist alongside the POST to /api/quote so a customer whose send
 * failed — or who simply prefers their own mail client or the phone — can
 * still get the list to the desk with nothing retyped. The mailto body is
 * the customer's own draft in their own mail client; it never touches the
 * desk pipeline, the CSV, or the store.
 */

export const DESK_EMAIL = "parts@jmequipment.net";
export const DESK_PHONE_DISPLAY = "(269) 659-0093";
/** E.164 for the tel: link — dialers on both platforms accept it. */
export const DESK_PHONE_TEL = "+12696590093";

/** Keep the URL inside what common mail clients accept (~2 KB total). */
const MAX_LINES = 40;

export function requestListText(items: RequestItem[], reference?: string | null): string {
  const lines: string[] = [];
  lines.push(reference ? `Quote request ${reference}` : "Quote request");
  lines.push("");
  const shown = items.slice(0, MAX_LINES);
  for (const it of shown) {
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    let line = `${it.sku} · ${it.name} · qty ${qty}`;
    if (it.configLabel) line += ` · ${it.configLabel}`;
    if (it.source) line += ` · ${it.source}`;
    lines.push(line);
  }
  if (items.length > shown.length) {
    lines.push(`+ ${items.length - shown.length} more line(s) — see the printed summary.`);
  }
  if (items.length === 0) lines.push("(no line items — question only)");
  lines.push("");
  lines.push("Please confirm fitment, lead time, and freight in writing.");
  return lines.join("\n");
}

export function mailtoHref(items: RequestItem[], reference?: string | null): string {
  const subject = reference ? `Quote request ${reference}` : `Quote request — ${items.length} line(s)`;
  const body = requestListText(items, reference);
  return `mailto:${DESK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function telHref(): string {
  return `tel:${DESK_PHONE_TEL}`;
}

/**
 * The "Email it" route for a Support Hub request: the customer's own draft,
 * carrying the reference and what they typed, addressed to the desk. Like
 * the request-list mailto it never touches the desk pipeline or the store.
 */
export function supportMailtoHref(title: string, reference: string | null, rows: [string, string][]): string {
  const subject = reference ? `[${reference}] ${title}` : title;
  const body = [
    reference ? `Reference: ${reference}` : `Request: ${title}`,
    "",
    ...rows.slice(0, 20).map(([k, v]) => `${k}: ${String(v).replace(/\s+/g, " ").trim().slice(0, 300)}`),
    "",
    "Please confirm in writing.",
  ].join("\n");
  return `mailto:${DESK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
