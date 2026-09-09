import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { audit, hashKey } from "@/lib/auditLog";
import { sendRfqNotification } from "@/lib/mail";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { saveRfq, type StoredRfq } from "@/lib/rfqStore";
import { evaluateSupport } from "@/lib/supportRequest";

/**
 * Support Hub intake — the five typed forms on /support.
 *
 * Same posture as the quote endpoint: honeypot, per-IP rate limit, generic
 * failure wording, no PII in logs. The request is validated against the
 * form spec the page rendered from, stored as a request record with its
 * kind and labelled answers, and reaches the desk through the same inbox,
 * CSV export and notification email as a quote request. Nothing here
 * quotes, schedules or promises — every reply comes from a person, in writing.
 */

export const runtime = "nodejs";

const GENERIC_FAIL = "Please check the form and try again.";
const JME_PHONE = "(269) 659-0093";
const JME_EMAIL = "parts@jmequipment.net";

export async function POST(req: Request) {
  const key = clientKey(req);

  const rl = rateLimit(`support:${key}`, 5, 60_000);
  if (!rl.ok) {
    audit("support_rate_limited", { keyHash: hashKey(key) });
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { kind?: unknown; fields?: unknown; consent?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 400 });
  }

  const fields =
    body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)
      ? (body.fields as Record<string, unknown>)
      : {};
  const outcome = evaluateSupport(body.kind, fields, { website: body.website, consent: body.consent });

  if (outcome.kind === "honeypot") {
    audit("support_honeypot", { keyHash: hashKey(key) });
    return NextResponse.json({ ok: true, ref: "RFQ-IGNORED" }, { status: 200 });
  }
  if (outcome.kind === "invalid") {
    audit("support_invalid", { keyHash: hashKey(key) });
    return NextResponse.json({ ok: false, error: GENERIC_FAIL }, { status: 422 });
  }

  const { kind, contact, details, message } = outcome.request;
  const input = {
    contact: { ...contact, billingSameAsShipping: true, wantsAccount: true },
    items: [],
    message,
    freight: false,
    kind,
    details,
  };

  let rfq: StoredRfq;
  try {
    rfq = await saveRfq(input);
  } catch {
    // The store is unavailable. The customer filled the form correctly, so
    // do not send them round a "check the form" loop: try the desk email so
    // the request can be worked by hand, and say plainly what happened.
    const now = new Date().toISOString();
    const provisional: StoredRfq = {
      ref: "RFQ-UNSAVED-" + randomUUID().slice(0, 8).toUpperCase(),
      createdAt: now,
      updatedAt: now,
      status: "new",
      ...input,
    };
    const mailed = await sendRfqNotification(provisional).catch(() => false);
    audit("support_store_failed");
    console.error(`[support] STORE WRITE FAILED kind=${kind} desk_email=${mailed ? "sent" : "not sent"}`);
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

  void sendRfqNotification(rfq);
  audit("support_accepted");
  console.info(`[support] accepted ref=${rfq.ref} kind=${kind}`);

  return NextResponse.json({
    ok: true,
    ref: rfq.ref,
    message: "Request received. The parts desk replies in writing — this is not scheduled work or a firm quotation until confirmed.",
  });
}
