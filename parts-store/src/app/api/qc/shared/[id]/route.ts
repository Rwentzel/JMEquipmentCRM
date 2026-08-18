import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendQuoteAcceptedNotification } from "@/lib/mail";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { buildDoc, deriveActivity, nowISO } from "@/lib/qc/logic";
import { mutateQuote, readQcState } from "@/lib/qc/store";

/**
 * Client Quote View API — the ONLY public read path into the quote store.
 *
 * GET  → the CLIENT-SAFE document model (buildDoc: no cost/margin/internal
 *        fields) for one quote; requires the per-quote capability token
 *        (?t=), checked in constant time. Logs a "viewed" activity entry
 *        (once per day, like the prototype).
 * POST → typed-signature accept: {name, token} ⇒ status "accepted" + activity.
 *
 * Rate-limited; unknown ids and bad tokens return the same generic 404.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenMatches(expected: string | undefined, given: string): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rl = rateLimit(`qcshared:${clientKey(req)}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const state = await readQcState();
  const quote = state.quotes.find((q) => q.id === id);
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!quote || !tokenMatches(quote.token, token)) return NextResponse.json({ ok: false }, { status: 404 });

  // Record the view (once per day) — non-fatal if it races.
  const today = nowISO();
  const act = deriveActivity(quote);
  let seenToday = false;
  for (let i = act.length - 1; i >= 0; i--) {
    if (act[i]!.type === "viewed") {
      seenToday = act[i]!.date === today;
      break;
    }
  }
  if (!seenToday) {
    await mutateQuote(id, (q) => ({ ...q, activity: [...deriveActivity(q), { type: "viewed", date: today }] }));
  }

  const machine = quote.machineId ? state.catalog.find((m) => m.id === quote.machineId) || null : null;
  const doc = buildDoc(quote, machine, state.settings);
  const canAccept = quote.status !== "accepted" && quote.status !== "won";
  return NextResponse.json({ ok: true, doc, canAccept });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rl = rateLimit(`qcaccept:${clientKey(req)}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  let body: { name?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 200);
  if (!name) return NextResponse.json({ ok: false, error: "Type your name to sign" }, { status: 422 });

  const preState = await readQcState();
  const target = preState.quotes.find((q) => q.id === id);
  if (!target || !tokenMatches(target.token, String(body.token ?? ""))) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const alreadySigned = target.status === "accepted" || target.status === "won";
  const signedDate = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const updated = await mutateQuote(id, (q) => {
    if (q.status === "accepted" || q.status === "won") return q;
    return {
      ...q,
      status: "accepted",
      signedName: name,
      signedDate,
      activity: [...deriveActivity(q), { type: "accepted", date: nowISO(), by: name }],
    };
  });
  if (!updated) return NextResponse.json({ ok: false }, { status: 404 });

  const state = await readQcState();
  const machine = updated.machineId ? state.catalog.find((m) => m.id === updated.machineId) || null : null;
  const doc = buildDoc(updated, machine, state.settings);

  // Tell the desk — the client page promises this. Fire-and-forget: a mail
  // failure must never fail an acceptance that is already persisted, and
  // re-opening an accepted quote must not re-notify.
  if (!alreadySigned && doc) {
    void sendQuoteAcceptedNotification({
      number: updated.number,
      company: updated.clientCompany,
      contact: updated.clientContact || "",
      contactEmail: updated.clientEmail || "",
      // Describe what the customer signed, taken from the document they signed.
      // Asking the catalogue entry instead reported "Parts / components" for a
      // guillotine cutter with no Quote Center entry attached, and the
      // catalogue's own SKU and default build for anything configured — and
      // this is the text the rep confirms deposit terms against.
      machine: `${doc.machineName} (${doc.sku})${doc.machineSubtitle ? ` — ${doc.machineSubtitle}` : ""}`,
      total: doc.pricing.total,
      signedName: name,
      signedDate,
      rep: updated.rep || state.settings.rep,
    });
  }

  return NextResponse.json({ ok: true, doc, canAccept: false });
}
