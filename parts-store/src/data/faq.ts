/**
 * Public FAQ — shared by the storefront FAQ section and the support agent.
 * Everything here is customer-safe, RFQ-first copy. No prices, no quantities.
 */

export interface FaqEntry {
  q: string;
  a: string;
  /** Keywords the rules-based support engine matches against. */
  keys: string[];
}

export const FAQ: FaqEntry[] = [
  {
    q: "Why don't I see prices online?",
    a: "Industrial parts and machines are quoted individually — pricing depends on configuration, freight, and lead time. Add what you need to a request and the desk confirms everything in writing.",
    keys: ["price", "prices", "pricing", "cost", "how much", "dollar", "quote"],
  },
  {
    q: "How fast do parts ship?",
    a: "98% of stocked parts ordered by early afternoon leave the Sturgis dock the same day. Availability is shown as a status band; exact timing is confirmed on your quote.",
    keys: ["ship", "shipping", "fast", "lead time", "delivery", "when", "same day"],
  },
  {
    q: "Can you match a part from another OEM's machine?",
    a: "Often, yes. Send the machine serial number and a description or photo; we verify fit before quoting rather than guessing.",
    keys: ["oem", "match", "cross", "fit", "compatible", "serial", "another machine"],
  },
  {
    q: "Do you handle freight on heavy items?",
    a: "Yes. Freight-heavy parts and machines are quoted with freight so there are no surprises — they're flagged \"Freight Quote Required.\"",
    keys: ["freight", "heavy", "shipping cost", "truck", "crate", "ltl"],
  },
  {
    q: "Is a request a binding order?",
    a: "No. Submitting a request asks for a firm written quotation. Nothing is ordered or charged until you approve the quote.",
    keys: ["binding", "order", "charged", "commit", "obligation", "cancel"],
  },
];
