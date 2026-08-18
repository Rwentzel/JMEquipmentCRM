import { NextResponse } from "next/server";
import { catalog } from "@/data/catalog";
import { details } from "@/data/details";
import { goodstrongDiagramSkus, goodstrongModels } from "@/data/goodstrong";
import { audit, hashKey } from "@/lib/auditLog";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { sendRfqNotification } from "@/lib/mail";
import { saveRfq, type StoredRfq, type StoredRfqContact } from "@/lib/rfqStore";
import { randomUUID } from "node:crypto";
import { evaluateQuote } from "@/lib/validateQuote";

/**
 * Quote (RFQ) intake endpoint — hardened.
 *
 * Validates the contact block and line items server-side, persists the RFQ to
 * the local ops store (gitignored `.data/`, readable only through the
 * token-gated ops API), and returns a safe crypto-random reference. Desk
 * email delivery is env-gated (lib/mail.ts — SMTP_* + RFQ_NOTIFY_TO) and
 * fire-and-forget; there is no payment processor.
 *
 * Hardening: honeypot rejection, in-memory per-IP rate limiting, no PII
 * logging (audit events carry counts + hashed keys only), generic responses.
 */

export const runtime = "nodejs";

interface IncomingItem {
  sku?: unknown;
  qty?: unknown;
  /** Configurator choice ids (DetailChoice.sku), resolved to labels server-side. */
  options?: unknown;
  /** Manual-drawing location, resolved and verified server-side. */
  origin?: unknown;
}

/**
 * Turn a manual-drawing location into the line the desk reads, but only after
 * confirming this part really is at that spot in our own diagram data.
 *
 * The desk confirms fit from the drawing and bubble number, and the same part
 * number appears on more than one drawing, so losing this costs a phone call
 * on every diagram order. Rebuilding the text here rather than trusting the
 * browser's means a crafted value cannot reach the desk email or the CSV.
 */
function resolveOrigin(sku: string, raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { model?: unknown; section?: unknown; page?: unknown; bubble?: unknown };
  const modelId = String(o.model ?? "");
  const sectionId = String(o.section ?? "");
  const pageLabel = String(o.page ?? "");
  const bubble = Number(o.bubble);

  const model = goodstrongModels.find((m) => m.id === modelId);
  const section = model?.sections.find((sec) => sec.id === sectionId);
  const page = model?.diagrams[sectionId]?.find((pg) => pg.pageLabel === pageLabel);
  if (!model || !section || !page) return null;
  if (!page.parts.some((part) => part.sku === sku && part.bubble === bubble)) return null;

  return `${model.label} · ${section.label} · p.${page.pageLabel} · #${bubble}`;
}

/**
 * Turn configurator choice ids into the labels the desk reads.
 *
 * Resolution happens here, against this machine's own option set, for two
 * reasons: an id that machine does not offer is rejected rather than passed
 * along, and nothing a customer can type reaches the desk email or the CSV
 * export by this route — only text from our own data.
 */
function resolveOptions(machineSku: string, raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const opts = details[machineSku]?.options ?? [];
  if (opts.length === 0) return [];

  const wanted = new Set(raw.slice(0, 40).map((v) => String(v)));
  const lines: string[] = [];
  for (const opt of opts) {
    const picked = opt.choices.filter((c) => wanted.has(c.sku));
    if (picked.length > 0) lines.push(`${opt.label}: ${picked.map((c) => c.v).join(", ")}`);
  }
  return lines;
}

const validSkus = new Set<string>([
  ...catalog.machines.map((m) => m.sku),
  ...catalog.parts.map((p) => p.sku),
  // Parts listed on Goodstrong manual diagram pages are orderable too.
  ...goodstrongDiagramSkus(),
]);

const freightSkus = new Set<string>(
  [...catalog.machines, ...catalog.parts].filter((x) => x.action === "freight-quote").map((x) => x.sku),
);

const GENERIC_FAIL = "Please check the form and try again.";

// Fallback contact details, for the case where we cannot record the request.
const JME_PHONE = "(269) 659-0093";
const JME_EMAIL = "parts@jmequipment.net";

/** Trim + cap a user-supplied string before persistence. */
function clean(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  const key = clientKey(req);

  // Rate limit first (cheap; protects the rest).
  const rl = rateLimit(`quote:${key}`, 5, 60_000);
  if (!rl.ok) {
    audit("quote_rate_limited", { keyHash: hashKey(key) });
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { contact?: Record<string, unknown>; items?: IncomingItem[]; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 400 });
  }

  const contact = body.contact ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  const messageOnly = body.mode === "message";

  const outcome = evaluateQuote(contact, items, validSkus, { messageOnly });

  // Honeypot: respond with a generic success and do nothing (bots fill it).
  if (outcome.kind === "honeypot") {
    audit("quote_honeypot", { keyHash: hashKey(key) });
    return NextResponse.json({ ok: true, ref: "RFQ-IGNORED" }, { status: 200 });
  }
  if (outcome.kind === "invalid") {
    audit("quote_invalid", { keyHash: hashKey(key) });
    // Generic message — do not leak which field failed or echo PII.
    return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 422 });
  }

  const storedItems = items.map((it) => {
    const sku = String(it.sku);
    const config = resolveOptions(sku, it.options);
    const source = resolveOrigin(sku, it.origin);
    return {
      sku,
      qty: Math.min(Math.max(Math.floor(Number(it.qty)), 1), 9999),
      ...(config.length > 0 ? { config } : {}),
      ...(source ? { source } : {}),
    };
  });

  const contactBlock: StoredRfqContact = {
    company: clean(contact.company, 200),
    name: clean(contact.name, 200),
    lastName: clean(contact.lastName, 200) || undefined,
    email: clean(contact.email, 320),
    phone: clean(contact.phone, 40) || undefined,
    phoneExt: clean(contact.phoneExt, 10) || undefined,
    serial: clean(contact.serial, 80) || undefined,
    shipAddress: clean(contact.shipAddress, 500) || undefined,
    billingSameAsShipping: contact.billingSameAsShipping !== false,
    billingAddress: contact.billingSameAsShipping === false ? clean(contact.billingAddress, 500) || undefined : undefined,
    wantsAccount: contact.wantsAccount !== false,
  };
  const message = clean(contact.message, 4000) || undefined;
  const freight = storedItems.some((it) => freightSkus.has(it.sku));

  let rfq: StoredRfq;
  try {
    rfq = await saveRfq({ contact: contactBlock, items: storedItems, message, freight });
  } catch (err) {
    // The store is unavailable (full volume, detached mount, bad permissions).
    // A customer who filled the form correctly must not be told to check it,
    // and the enquiry must not evaporate: try the desk email anyway, so JM can
    // work the lead by hand even with no store behind it.
    const now = new Date().toISOString();
    const provisional: StoredRfq = {
      ref: "RFQ-UNSAVED-" + randomUUID().slice(0, 8).toUpperCase(),
      createdAt: now,
      updatedAt: now,
      status: "new",
      contact: contactBlock,
      items: storedItems,
      message,
      freight,
    };
    const mailed = await sendRfqNotification(provisional).catch(() => false);

    audit("quote_store_failed", { n: storedItems.length });
    // No PII, and no raw error text (it can carry filesystem paths).
    console.error(`[quote] STORE WRITE FAILED items=${storedItems.length} desk_email=${mailed ? "sent" : "not sent"}`);

    return NextResponse.json(
      {
        ok: false,
        stored: false,
        error: mailed
          ? `Your request reached the parts desk by email, but our system could not file it. Nothing is lost — if you do not hear back within one business day, call ${JME_PHONE}.`
          : `We could not record your request. Please call ${JME_PHONE} or email ${JME_EMAIL} and we will pick it up right away.`,
      },
      { status: 503 },
    );
  }

  // Notify the parts desk (env-gated; no-op without SMTP config). Fire and
  // forget — delivery must never delay or fail the customer's response.
  void sendRfqNotification(rfq);

  // No PII logging — counts only.
  audit("quote_accepted", { n: storedItems.length });
  console.info(`[quote] accepted ref=${rfq.ref} items=${storedItems.length}`);

  return NextResponse.json({
    ok: true,
    ref: rfq.ref,
    message: "Request received. The parts desk replies in writing — this is not a binding order.",
  });
}
