/**
 * Desk email delivery — env-gated SMTP notifications to JM Equipment:
 * new RFQs from the parts store, and quote acceptances from the Quote
 * Center's client link.
 *
 * SECURITY / DATA PROTECTION:
 * - Credentials come ONLY from environment variables (SMTP_HOST, SMTP_PORT,
 *   SMTP_USER, SMTP_PASS, RFQ_NOTIFY_TO, RFQ_NOTIFY_FROM) — never the repo.
 * - Unconfigured (the default), delivery is a silent no-op: the RFQ is still
 *   persisted and visible in the ops desk, so nothing is lost.
 * - Delivery failures NEVER fail the customer's request, and no PII is ever
 *   logged — the audit trail records only mail_sent / mail_error events.
 * - The email goes to JM's own desk inbox; customers are not auto-emailed
 *   (auto-replies invite spam amplification — see LAUNCH.md).
 */

import nodemailer from "nodemailer";
import { audit } from "@/lib/auditLog";
import type { StoredRfq } from "@/lib/rfqStore";
import { catalog } from "@/data/catalog";
import { siteUrl } from "@/lib/launch";

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.RFQ_NOTIFY_TO);
}

/**
 * Public catalog names by SKU. Built once; public data only (the same names
 * the storefront shows), so this adds nothing to the email that a customer
 * could not already see.
 */
const CATALOG_NAMES: Map<string, string> = new Map([
  ...catalog.machines.map((m) => [m.sku, m.name] as const),
  ...catalog.parts.map((p) => [p.sku, p.name] as const),
]);

/** Part or machine name for a SKU, or null for anything not in the catalog. */
function catalogName(sku: string): string | null {
  return CATALOG_NAMES.get(sku) ?? null;
}

/**
 * The address the desk notification is sent from.
 *
 * This used to fall back to SMTP_USER, on the assumption that an SMTP username
 * is an address. For several of the providers JM is most likely to sign up
 * with, it is not: SendGrid's username is the literal string "apikey", SES
 * uses an access-key id, Postmark a server token. Handing one of those to
 * nodemailer as `from` produces a message with **no From header at all** —
 * malformed per RFC 5322 — and leaves the envelope sender as the customer's
 * own address, which fails SPF for their domain.
 *
 * The visible symptom is the worst kind: the request saves, the ops desk shows
 * it, nothing errors, and the email simply never arrives.
 *
 * So SMTP_USER is used only when it actually looks like an address. Set
 * RFQ_NOTIFY_FROM to control this explicitly.
 */
export function notifyFrom(): string {
  const explicit = process.env.RFQ_NOTIFY_FROM?.trim();
  if (explicit) return explicit;
  const user = process.env.SMTP_USER?.trim();
  if (user && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return user;
  return "parts-store@jmequipment.net";
}

/**
 * Collapse a customer-typed value onto one line.
 *
 * The notification is a `Key: value` list, so a newline inside any of those
 * values forges a new line in it. A company name of
 * "Acme Converting\nEmail:    attacker@evil.test" puts a fake contact address
 * directly above the real one, and the desk reads top-down. Not header
 * injection — nodemailer encodes the subject — but the desk acts on this
 * email, so the lines in it have to be ours.
 */
function oneLine(v: unknown): string {
  return String(v ?? "").replace(/[\r\n]+/g, "  ").trim();
}

/** Indent a free-text block so it cannot be mistaken for the key lines above it. */
function indentBlock(v: string): string {
  return oneLine(v) ? String(v).split(/\r?\n/).map((l) => "  " + l).join("\n") : "";
}

/** Plain-text desk notification. Pure — unit-tested without a transport. */
export function formatRfqEmail(rfq: StoredRfq): { subject: string; text: string } {
  const c = rfq.contact;
  const lines = [
    `New quote request ${rfq.ref}${rfq.freight ? " — FREIGHT QUOTE REQUIRED" : ""}`,
    `Received: ${rfq.createdAt}`,
    "",
    `Company:  ${oneLine(c.company)}`,
    `Contact:  ${oneLine([c.name, c.lastName].filter(Boolean).join(" "))}`,
    `Email:    ${oneLine(c.email)}`,
  ];
  if (c.phone) lines.push(`Phone:    ${oneLine(c.phone)}${c.phoneExt ? ` ext. ${oneLine(c.phoneExt)}` : ""}`);
  if (c.serial) lines.push(`Serial:   ${oneLine(c.serial)}`);
  if (c.shipAddress) lines.push(`Ship to:  ${oneLine(c.shipAddress)}`);
  if (c.billingSameAsShipping === false && c.billingAddress) lines.push(`Bill to:  ${oneLine(c.billingAddress)}`);
  if (c.wantsAccount === false) lines.push("Account:  customer opted OUT of an account");
  lines.push("", "Items:");
  for (const it of rfq.items) {
    // Name the part. A SKU on its own means looking up every line before the
    // desk can even tell what was asked for, on every lead.
    const name = catalogName(it.sku);
    lines.push(`  ${it.sku}  × ${it.qty}${name ? `  — ${name}` : ""}`);
  }
  if (rfq.message) lines.push("", "Message:", indentBlock(rfq.message));
  lines.push(
    "",
    `Work this request in the ops desk: ${siteUrl()}/ops (ref ${rfq.ref}).`,
    "This notification was generated by the parts store; reply goes to the customer address above.",
  );
  return {
    subject: `[RFQ] ${rfq.ref} — ${oneLine(c.company)}${rfq.freight ? " (freight)" : ""}`,
    text: lines.join("\n"),
  };
}

/**
 * Send the desk notification. Fire-and-forget safe: never throws, never
 * blocks or fails the customer response, no PII in logs.
 */
export async function sendRfqNotification(rfq: StoredRfq): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    const { subject, text } = formatRfqEmail(rfq);
    await transporter.sendMail({
      from: notifyFrom(),
      to: process.env.RFQ_NOTIFY_TO,
      replyTo: rfq.contact.email,
      subject,
      text,
    });
    audit("mail_sent");
    return true;
  } catch {
    // No PII, no error detail with addresses — the RFQ is safe in the store.
    audit("mail_error");
    console.error(`[mail] delivery failed for ${rfq.ref} — RFQ persisted; check SMTP_* configuration`);
    return false;
  }
}

/* ------------------------------------------------- quote acceptance --- */

export interface AcceptedQuoteNotice {
  number: string;
  company: string;
  contact: string;
  contactEmail: string;
  machine: string;
  total: string;
  signedName: string;
  signedDate: string;
  rep: string;
}

/**
 * Plain-text desk notification for a customer-signed quote. Pure —
 * unit-tested without a transport. Deliberately carries no cost or margin:
 * the acceptance is a customer-side event and this text is quoted back in
 * follow-ups (see DATA_BOUNDARIES.md).
 */
export function formatQuoteAcceptedEmail(a: AcceptedQuoteNotice): { subject: string; text: string } {
  const lines = [
    `Quote ${a.number} was ACCEPTED by the customer.`,
    "",
    `Signed by: ${a.signedName}`,
    `Signed on: ${a.signedDate}`,
    "",
    `Company:   ${a.company}`,
  ];
  if (a.contact) lines.push(`Contact:   ${a.contact}`);
  if (a.contactEmail) lines.push(`Email:     ${a.contactEmail}`);
  lines.push(
    `Equipment: ${a.machine}`,
    `Total:     ${a.total}`,
    `Sales rep: ${a.rep}`,
    "",
    `Open it in the Quote Center: /quotes/pipeline (quote ${a.number}).`,
    "Next step: confirm the deposit terms and move the quote to Won once the PO lands.",
  );
  return {
    subject: `[ACCEPTED] ${a.number} — ${a.company}`,
    text: lines.join("\n"),
  };
}

/**
 * Send the acceptance notification. Fire-and-forget safe: never throws and
 * never fails the customer's accept — the signature is already persisted.
 */
export async function sendQuoteAcceptedNotification(a: AcceptedQuoteNotice): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    const { subject, text } = formatQuoteAcceptedEmail(a);
    await transporter.sendMail({
      from: notifyFrom(),
      to: process.env.RFQ_NOTIFY_TO,
      ...(a.contactEmail ? { replyTo: a.contactEmail } : {}),
      subject,
      text,
    });
    audit("mail_sent");
    return true;
  } catch {
    // Acceptance is already recorded in the store — never surface mail errors
    // to the customer, and never log the signer's details.
    audit("mail_error");
    console.error(`[mail] acceptance notice failed for ${a.number} — signature persisted; check SMTP_* configuration`);
    return false;
  }
}
