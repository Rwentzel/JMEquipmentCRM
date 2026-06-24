import { NextResponse } from "next/server";
import { catalog } from "@/data/catalog";

/**
 * Quote request endpoint — SANDBOX.
 *
 * Validates the contact block and line items server-side and returns a
 * reference number. It does NOT email, charge, or persist anything: there is
 * no SMTP/Resend, no payment processor, and no database wired up. This is a
 * deliberate sandbox stub until those integrations are approved.
 */

interface IncomingItem {
  sku?: unknown;
  name?: unknown;
  price?: unknown;
  qty?: unknown;
}

const validSkus = new Set<string>([
  ...catalog.machines.map((m) => m.sku),
  ...catalog.parts.map((p) => p.sku),
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { contact?: Record<string, unknown>; items?: IncomingItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const contact = body.contact ?? {};
  const items = Array.isArray(body.items) ? body.items : [];

  const errors: string[] = [];

  const company = String(contact.company ?? "").trim();
  const name = String(contact.name ?? "").trim();
  const email = String(contact.email ?? "").trim();

  if (!company) errors.push("Company is required.");
  if (!name) errors.push("Contact name is required.");
  if (!email) errors.push("Email is required.");
  else if (!EMAIL_RE.test(email)) errors.push("Email is not valid.");

  if (items.length === 0) errors.push("Your request list is empty.");

  for (const it of items) {
    const sku = String(it.sku ?? "");
    if (!validSkus.has(sku)) {
      errors.push(`Unknown SKU: ${sku || "(blank)"}.`);
    }
    const qty = Number(it.qty);
    if (!Number.isFinite(qty) || qty < 1) {
      errors.push(`Invalid quantity for ${sku || "item"}.`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors[0], errors }, { status: 422 });
  }

  // Generate a reference. In a real implementation this is where the request
  // would be queued for the parts desk (email / CRM), never charged here.
  const ref = "R-" + Date.now().toString(36).toUpperCase();

  return NextResponse.json({
    ok: true,
    ref,
    received: items.length,
    message: "Quote request received. The parts desk replies in writing — this is not a binding order.",
  });
}
