import type { RfqAction } from "@/data/types";

/** Small shared helpers — no external dependencies. */

/** Join class names, dropping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Resolve a photo filename to a public path; placeholder handling is per-component. */
export function asset(file: string): string {
  return "/images/" + file;
}

const ACTION_LABELS: Record<RfqAction, string> = {
  "request-quote": "Request Quote",
  call: "Call for Availability",
  "freight-quote": "Freight Quote",
  backorder: "Backorder — Request",
  contact: "Contact JM",
};

/** CTA label for an RFQ action. No public "Buy Now" (RFQ-first). */
export function actionLabel(action: RfqAction): string {
  return ACTION_LABELS[action] ?? "Request Quote";
}
