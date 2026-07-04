/**
 * Support agent — customer-facing parts-desk assistant.
 *
 * Grounded EXCLUSIVELY on the public catalog and public FAQ. It answers
 * availability as status bands, routes everything transactional to the RFQ
 * flow, and refuses pricing/quantity/vendor questions by policy — enforced
 * here in code (guardrail screen) as well as in the LLM system prompt, so the
 * boundary holds even if the model misbehaves. Works fully offline via a
 * deterministic rules engine when no ANTHROPIC_API_KEY is configured.
 */

import { catalog } from "@/data/catalog";
import { FAQ } from "@/data/faq";
import { aiAvailable, complete } from "@/lib/ai/provider";
import { actionLabel } from "@/lib/utils";

export interface SupportAnswer {
  answer: string;
  /** Which engine produced the answer. */
  engine: "ai" | "rules";
  /** Catalog SKUs referenced, so the UI can deep-link them. */
  skus: string[];
}

const DESK_LINE = `Call ${catalog.contact.phone} or email ${catalog.contact.email} — the parts desk replies in writing.`;

const PRICING_REFUSAL =
  "Pricing and exact stock counts aren't published online — every quote is confirmed in writing based on configuration, freight, and lead time. Add the item to a request (it takes under a minute) and the desk will send a firm written quote. " +
  DESK_LINE;

/** Questions that must never be answered with specifics, on any engine. */
const GUARDED = /\b(price|prices|pricing|cost|costs|how much|discount|margin|markup|how many (do|are)|units in stock|quantity on hand|vendor|supplier|wholesale|distributor)\b/i;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Find catalog items (machines + parts) mentioned by SKU or name keywords. */
function matchCatalog(q: string): Array<{ sku: string; name: string; band: string; action: string }> {
  const nq = norm(q);
  const hits: Array<{ sku: string; name: string; band: string; action: string }> = [];
  for (const m of catalog.machines) {
    if (nq.includes(m.sku.toLowerCase()) || nq.includes(norm(m.name)) || nq.includes(norm(m.family))) {
      hits.push({ sku: m.sku, name: m.name, band: m.statusBand, action: actionLabel(m.action) });
    }
  }
  for (const p of catalog.parts) {
    const words = norm(p.name).split(" ").filter((w) => w.length > 3);
    const nameHit = words.length > 0 && words.every((w) => nq.includes(w));
    if (nq.includes(p.sku.toLowerCase()) || nameHit) {
      hits.push({ sku: p.sku, name: p.name, band: p.statusBand, action: actionLabel(p.action) });
    }
  }
  return hits.slice(0, 4);
}

function matchFaq(q: string): string | null {
  const nq = norm(q);
  let best: { score: number; a: string } | null = null;
  for (const f of FAQ) {
    const score = f.keys.filter((k) => nq.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) best = { score, a: f.a };
  }
  return best?.a ?? null;
}

/** Deterministic engine — always available, zero dependencies. */
function rulesAnswer(question: string): SupportAnswer {
  const hits = matchCatalog(question);
  const faq = matchFaq(question);

  const parts: string[] = [];
  if (hits.length > 0) {
    for (const h of hits) {
      parts.push(`${h.name} (${h.sku}) — availability: ${h.band}. Next step: ${h.action}.`);
    }
    parts.push("Add it to your request list and the desk confirms fit, availability, and pricing in writing.");
  }
  if (faq) parts.push(faq);
  if (parts.length === 0) {
    parts.push(
      "I can help with machine and part availability, fit questions, freight, and how quoting works. " +
        "Tell me a part number, machine model, or what you're trying to fix — or " +
        DESK_LINE.toLowerCase(),
    );
  }
  return { answer: parts.join("\n\n"), engine: "rules", skus: hits.map((h) => h.sku) };
}

/** Public-catalog context for the LLM — sanitized data only, by construction. */
function publicContext(): string {
  const machines = catalog.machines.map((m) => ({
    sku: m.sku,
    name: m.name,
    family: m.family,
    status: m.statusBand,
    nextStep: actionLabel(m.action),
    blurb: m.blurb,
  }));
  const parts = catalog.parts.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.cat,
    status: p.statusBand,
    nextStep: actionLabel(p.action),
  }));
  return JSON.stringify({ machines, parts, faq: FAQ.map((f) => ({ q: f.q, a: f.a })) });
}

const SYSTEM_PROMPT = `You are the JM Equipment parts-desk assistant on a public website. JM Equipment Inc. builds, rebuilds, and supports converting machinery (sheeters, rollstands, core splitters) in Sturgis, Michigan, since 1989.

HARD RULES — never break these:
- NEVER state or estimate a price, cost, discount, or margin. All pricing is quoted in writing via the request flow.
- NEVER state exact inventory quantities. Availability is expressed only as the status bands provided.
- NEVER mention vendors, suppliers, part sourcing, or internal systems.
- Only use facts from the CATALOG JSON below. If it's not there, say the desk can confirm and point to phone/email.
- Keep answers short (2-4 sentences), plain, and practical. Always end transactional questions by pointing to the Request Quote flow, ${catalog.contact.phone}, or ${catalog.contact.email}.

CATALOG: ${publicContext()}`;

/** Answer a customer question. Guardrails apply before any engine runs. */
export async function answerSupportQuestion(question: string): Promise<SupportAnswer> {
  const q = String(question ?? "").trim().slice(0, 500);
  if (!q) {
    return { answer: "Ask me about a part, a machine, freight, or how quoting works.", engine: "rules", skus: [] };
  }

  // Policy guardrail — refuse pricing/quantity/vendor specifics on ANY engine.
  if (GUARDED.test(q)) {
    return { answer: PRICING_REFUSAL, engine: "rules", skus: matchCatalog(q).map((h) => h.sku) };
  }

  if (aiAvailable()) {
    const text = await complete({ system: SYSTEM_PROMPT, user: q, maxTokens: 400 });
    // Belt-and-braces: if the model output looks like it leaked a price, fall back.
    if (text && !/\$\s?\d/.test(text)) {
      return { answer: text, engine: "ai", skus: matchCatalog(q).map((h) => h.sku) };
    }
  }
  return rulesAnswer(q);
}
