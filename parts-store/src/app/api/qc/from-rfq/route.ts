import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/lib/auditLog";
import { OPS_COOKIE, opsMode, verifySession } from "@/lib/opsAuth";
import { blankQuote } from "@/lib/qc/logic";
import { PARTS_MASTER } from "@/lib/qc/partsMaster";
import { patchQcState, readQcState } from "@/lib/qc/store";
import type { QcQuotePart } from "@/lib/qc/types";
import { getRfq, updateRfqStatus } from "@/lib/rfqStore";

/**
 * Turn a storefront RFQ into a draft quote — INTERNAL, ops-gated.
 *
 * The RFQ already carries everything a quote needs to start: who asked, how
 * to reach them, where it ships, and which SKUs at what quantity. Without
 * this the rep retypes all of it, which is both slow and how transcription
 * errors reach a customer-facing document.
 *
 * Line items resolve against the parts master for name and price; anything
 * not on the master becomes an RFQ line (priced at consult) rather than
 * being dropped, so nothing the customer asked for silently disappears.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (opsMode() === "disabled") return NextResponse.json({ ok: false }, { status: 403 });
  if (opsMode() !== "dev-open" && !verifySession((await cookies()).get(OPS_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: { ref?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ref = String(body.ref ?? "").trim();
  if (!ref) return NextResponse.json({ ok: false }, { status: 400 });

  const rfq = await getRfq(ref);
  if (!rfq) return NextResponse.json({ ok: false, error: "Unknown request" }, { status: 404 });

  const state = await readQcState();
  const q = blankQuote(null, state.catalog, state.settings, state.quotes.length);

  // A parts request is not an equipment quote — start with no machine.
  q.machineId = null;
  q.base = 0;
  q.crating = 0;

  const c = rfq.contact;
  q.clientCompany = c.company || "";
  q.clientContact = [c.name, c.lastName].filter(Boolean).join(" ");
  q.clientEmail = c.email || "";
  q.clientCity = c.shipAddress || "";

  q.parts = rfq.items.map((it): QcQuotePart => {
    const master = PARTS_MASTER.find((p) => p.sku === it.sku);
    const price = master && master.price > 0 ? master.price : 0;
    return {
      sku: it.sku,
      name: master ? master.name : it.sku,
      qty: Math.max(1, +it.qty || 1),
      price,
      // Unknown SKU or consult-priced part: carry it as an RFQ line so it is
      // visibly pending a price rather than quietly quoted at $0.
      rfq: price === 0,
    };
  });

  const provenance = [
    `Created from ${rfq.ref} (submitted ${rfq.createdAt.slice(0, 10)}).`,
    c.phone ? `Phone: ${c.phone}${c.phoneExt ? ` ext. ${c.phoneExt}` : ""}` : "",
    c.serial ? `Machine serial: ${c.serial}` : "",
    c.billingSameAsShipping === false && c.billingAddress ? `Bill to: ${c.billingAddress}` : "",
    rfq.freight ? "FREIGHT QUOTE REQUESTED." : "",
    rfq.message ? `Customer note: "${rfq.message}"` : "",
  ].filter(Boolean);
  q.notes = provenance.join("\n");

  await patchQcState({ quotes: [q, ...state.quotes] });
  await updateRfqStatus(ref, "quoted");
  audit("qc_change", { n: 1 });

  return NextResponse.json({ ok: true, id: q.id, number: q.number });
}
