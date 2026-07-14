import { NextResponse } from "next/server";
import { catalog } from "@/data/catalog";
import { audit, hashKey } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rateLimit";
import { sendRfqNotification } from "@/lib/mail";
import { saveRfq } from "@/lib/rfqStore";
import { evaluateQuote } from "@/lib/validateQuote";

/**
 * Quote (RFQ) intake endpoint — hardened.
 *
 * Validates the contact block and line items server-side, persists the RFQ to
 * the local ops store (gitignored `.data/`, readable only through the
 * token-gated ops API), and returns a safe crypto-random reference. It does
 * NOT send email or charge anything — there is no SMTP/Resend and no payment
 * processor. Outbound delivery is a future step, configured via environment
 * variables only.
 *
 * Hardening: honeypot rejection, in-memory per-IP rate limiting, no PII
 * logging (audit events carry counts + hashed keys only), generic responses.
 */

export const runtime = "nodejs";

interface IncomingItem {
  sku?: unknown;
  qty?: unknown;
}

const validSkus = new Set<string>([
  ...catalog.machines.map((m) => m.sku),
  ...catalog.parts.map((p) => p.sku),
]);

const freightSkus = new Set<string>(
  [...catalog.machines, ...catalog.parts].filter((x) => x.action === "freight-quote").map((x) => x.sku),
);

const GENERIC_FAIL = "Please check the form and try again.";

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0]!.trim() : "") || req.headers.get("x-real-ip") || "local";
}

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

  const storedItems = items.map((it) => ({
    sku: String(it.sku),
    qty: Math.min(Math.max(Math.floor(Number(it.qty)), 1), 9999),
  }));

  const rfq = await saveRfq({
    contact: {
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
    },
    items: storedItems,
    message: clean(contact.message, 4000) || undefined,
    freight: storedItems.some((it) => freightSkus.has(it.sku)),
  });

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
