import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/lib/auditLog";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import type { QuoteStatus } from "@/lib/qc/pricing";
import {
  deleteClient,
  deleteQuote,
  getQcState,
  saveClient,
  saveQuote,
  saveSettings,
  setQuoteStatus,
} from "@/lib/qc/store";
import { getRfq } from "@/lib/rfqStore";

/**
 * Quote Center API — the ONLY read/write path to quotes (customer PII +
 * internal pricing/margin). Every method requires an ops session; internal
 * pricing never ships in any client bundle — it travels only through this
 * authed API at runtime.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(): Promise<boolean> {
  return verifySession((await cookies()).get(OPS_COOKIE)?.value);
}

export async function GET() {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 403 });
  const state = await getQcState();
  return NextResponse.json({ ok: true, ...state });
}

interface Body {
  kind?: unknown;
  quote?: Record<string, unknown>;
  client?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  id?: unknown;
  status?: unknown;
  lostReason?: unknown;
  rfqRef?: unknown;
}

export async function POST(req: Request) {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 403 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  switch (String(body.kind ?? "")) {
    case "saveQuote": {
      const q = body.quote as { clientCompany?: string } | undefined;
      if (!q?.clientCompany) return NextResponse.json({ ok: false, error: "Client company required." }, { status: 422 });
      const saved = await saveQuote(q as Parameters<typeof saveQuote>[0]);
      return NextResponse.json({ ok: true, quote: saved });
    }
    case "status": {
      const q = await setQuoteStatus(String(body.id ?? ""), String(body.status ?? "") as QuoteStatus, body.lostReason ? String(body.lostReason) : undefined);
      if (!q) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true, quote: q });
    }
    case "deleteQuote": {
      await deleteQuote(String(body.id ?? ""));
      return NextResponse.json({ ok: true });
    }
    case "saveClient": {
      const c = body.client as { company?: string } | undefined;
      if (!c?.company) return NextResponse.json({ ok: false, error: "Company required." }, { status: 422 });
      const saved = await saveClient(c as Parameters<typeof saveClient>[0]);
      return NextResponse.json({ ok: true, client: saved });
    }
    case "deleteClient": {
      await deleteClient(String(body.id ?? ""));
      return NextResponse.json({ ok: true });
    }
    case "saveSettings": {
      const s = await saveSettings((body.settings ?? {}) as Parameters<typeof saveSettings>[0]);
      return NextResponse.json({ ok: true, settings: s });
    }
    case "fromRfq": {
      // Seed a parts-mode draft from an RFQ in the inbox: contact + SKU lines
      // carry over; the desk prices each line (or leaves it RFQ) in the builder.
      const rfq = await getRfq(String(body.rfqRef ?? ""));
      if (!rfq) return NextResponse.json({ ok: false, error: "Unknown RFQ ref." }, { status: 404 });
      const saved = await saveQuote({
        machineId: null,
        clientCompany: rfq.contact.company,
        clientContact: [rfq.contact.name, rfq.contact.lastName].filter(Boolean).join(" "),
        clientCity: rfq.contact.shipAddress ?? "",
        clientEmail: rfq.contact.email,
        parts: rfq.items.map((it) => ({ sku: it.sku, name: it.sku, qty: it.qty, price: 0, rfq: true })),
        notes: [rfq.message, `From RFQ ${rfq.ref}`].filter(Boolean).join(" · "),
      });
      audit("qc_change");
      return NextResponse.json({ ok: true, quote: saved });
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown kind." }, { status: 422 });
  }
}
