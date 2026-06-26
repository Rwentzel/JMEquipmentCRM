import { NextResponse } from "next/server";
import { catalog } from "@/data/catalog";
import { rateLimit } from "@/lib/rateLimit";
import { evaluateQuote } from "@/lib/validateQuote";

/**
 * Quote (RFQ) intake endpoint — SANDBOX, hardened.
 *
 * Validates the contact block and line items server-side and returns a safe,
 * random reference. It does NOT send email, charge, or persist anything — there
 * is no SMTP/Resend, no payment processor, and no database. A real email/CRM
 * backend is a future step, configured via environment variables only.
 *
 * Hardening: honeypot rejection, in-memory per-IP rate limiting, no PII logging,
 * generic responses, and a crypto-random (non-time-derived) reference.
 *
 * TODO(production): deliver the RFQ via an email/CRM backend configured through
 * environment variables (never hard-coded), behind explicit approval.
 */

interface IncomingItem {
  sku?: unknown;
  qty?: unknown;
}

const validSkus = new Set<string>([
  ...catalog.machines.map((m) => m.sku),
  ...catalog.parts.map((p) => p.sku),
]);

const GENERIC_FAIL = "Please check the form and try again.";

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0]!.trim() : "") || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  // Rate limit first (cheap; protects the rest).
  const rl = rateLimit(`quote:${clientKey(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { contact?: Record<string, unknown>; items?: IncomingItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 400 });
  }

  const contact = body.contact ?? {};
  const items = Array.isArray(body.items) ? body.items : [];

  const outcome = evaluateQuote(contact, items, validSkus);

  // Honeypot: respond with a generic success and do nothing (bots fill it).
  if (outcome.kind === "honeypot") {
    return NextResponse.json({ ok: true, ref: "RFQ-IGNORED" }, { status: 200 });
  }
  if (outcome.kind === "invalid") {
    // Generic message — do not leak which field failed or echo PII.
    return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 422 });
  }

  // Safe, non-time-derived reference.
  const ref = "RFQ-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  // No PII logging — counts only.
  console.info(`[quote] accepted ref=${ref} items=${items.length}`);

  return NextResponse.json({
    ok: true,
    ref,
    message: "Request received. The parts desk replies in writing — this is not a binding order.",
  });
}
