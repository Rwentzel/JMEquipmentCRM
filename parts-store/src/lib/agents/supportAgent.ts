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
  "Pricing isn't published online — every quote is confirmed in writing based on configuration, freight, and lead time. Add the item to a request (it takes under a minute) and the desk will send a firm written quote. " +
  DESK_LINE;

const STOCK_REFUSAL =
  "We don't publish exact stock counts — they move through the day, and a number that is wrong by the time you read it helps nobody. Each item shows an availability band instead, and the desk confirms real availability and lead time in a written quote on your request. " +
  DESK_LINE;

const SOURCING_REFUSAL =
  "We don't discuss sourcing or supplier details. What we can tell you is what a part fits and how quickly we can get it to you — send the machine serial and what you're replacing, and the desk confirms fit and lead time in writing. " +
  DESK_LINE;

/**
 * Questions that must never be answered with specifics, on any engine.
 *
 * Split by subject so the refusal explains the actual reason. A customer
 * asking who supplies a bearing, and being told that "pricing isn't published
 * online", reads as a bot that did not understand the question — and it is the
 * sourcing boundary, not the pricing one, that is being protected.
 */
const GUARDED: Array<{ re: RegExp; refusal: string }> = [
  {
    // "supplies/supplied/supplying" and "who do you buy from" are the same
    // question as "supplier" and were slipping past this screen — a customer
    // asking "who supplies your bearings" got a parts listing instead of the
    // sourcing answer.
    re: /\b(vendor|vendors|supplier|suppliers|supplies|supplied|supplying|sourced|sourcing|wholesale|distributor|who makes|who manufactures|who do you (buy|get|source)|where do you (get|source|buy))\b/i,
    refusal: SOURCING_REFUSAL,
  },
  {
    re: /\b(how many (do|are|have)|units in stock|quantity on hand|stock count|how much stock|in stock right now)\b/i,
    refusal: STOCK_REFUSAL,
  },
  {
    // Real phrasing puts the thing between the count and the verb — "how many
    // splitter blades do you have in stock" — so the pattern above, which
    // needs do/are/have immediately after "how many", let it through and the
    // customer got a part card in place of an answer. The counting word has to
    // pair with a stock word: "how many teeth does the blade have" is a spec
    // question and must still be answered, and "is X in stock" stays an
    // availability question the band answers.
    re: /\bhow many\b[^?]*\b(in stock|on hand|on the shelf|stock|inventory|available|ship)\b/i,
    refusal: STOCK_REFUSAL,
  },
  {
    re: /\b(stock|inventory) levels?\b/i,
    refusal: STOCK_REFUSAL,
  },
  {
    // "what do you pay for it" and "what did that run you" are the same question
    // as "what does it cost", asked the way a buyer on the phone asks it. Without
    // them the part card answers, which never addresses what was asked.
    re: /\b(price|prices|pricing|cost|costs|how much|discount|margin|markup|quote me a number|what (do|did) (you|it|that) (pay|run)|do you pay)\b/i,
    refusal: PRICING_REFUSAL,
  },
];

function guardFor(q: string): string | null {
  return GUARDED.find((g) => g.re.test(q))?.refusal ?? null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Distinctive model tokens for a machine, e.g. "1650", "1600e", "vcs12".
 *
 * Customers refer to machines by model number, not by full catalogue name or
 * internal SKU — "specs on the 1650" is the normal phrasing. Matching only on
 * the whole SKU or whole name missed all of it. Tokens must contain a digit
 * and be at least three characters so that ordinary words and stray small
 * numbers cannot match.
 */
function modelTokens(sku: string, name: string): string[] {
  return [
    ...new Set(
      `${sku} ${name}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && /\d/.test(t)),
    ),
  ];
}

/** Find catalog items (machines + parts) mentioned by SKU, model, or name keywords. */
function matchCatalog(q: string): Array<{ sku: string; name: string; band: string; action: string }> {
  const nq = norm(q);
  const hits: Array<{ sku: string; name: string; band: string; action: string }> = [];
  for (const m of catalog.machines) {
    const byModel = modelTokens(m.sku, m.name).some((t) => new RegExp(`\\b${t}\\b`).test(nq));
    if (nq.includes(m.sku.toLowerCase()) || nq.includes(norm(m.name)) || nq.includes(norm(m.family)) || byModel) {
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

/** "What are the specs of the 1650?" — asking for the published spec plate. */
const SPEC_INTENT =
  /\b(spec|specs|specification|specifications|dimension|dimensions|how (wide|fast|big|heavy)|web width|cut-?off|capacity|throughput|horsepower|voltage|footprint)\b/i;

/** Published spec rows for a machine, if we hold any. Public data by construction. */
function specLines(sku: string): string | null {
  const machine = catalog.machines.find((m) => m.sku === sku);
  if (!machine?.specs?.length) return null;
  return machine.specs.slice(0, 6).map((row) => `${row.k}: ${row.v}`).join(" · ");
}

/** Deterministic engine — always available, zero dependencies. */
function rulesAnswer(question: string): SupportAnswer {
  const hits = matchCatalog(question);
  const faq = matchFaq(question);
  const wantsSpecs = SPEC_INTENT.test(question);

  const parts: string[] = [];
  if (hits.length > 0) {
    for (const h of hits) {
      const specs = wantsSpecs ? specLines(h.sku) : null;
      parts.push(
        `${h.name} (${h.sku}) — availability: ${h.band}. Next step: ${h.action}.` +
          (specs ? `\n${specs}` : ""),
      );
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

  // Policy guardrail — refuse pricing/quantity/sourcing specifics on ANY engine.
  const refusal = guardFor(q);
  if (refusal) {
    return { answer: refusal, engine: "rules", skus: matchCatalog(q).map((h) => h.sku) };
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
