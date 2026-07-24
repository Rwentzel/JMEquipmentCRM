import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientQuoteView } from "@/components/qc/ClientQuoteView";
import { buildDoc } from "@/lib/qc/logic";
import { readQcState } from "@/lib/qc/store";

/**
 * Client Quote View — the customer-facing page behind a shared link.
 * The URL carries a per-quote capability token (the id alone is not
 * enough), checked in constant time. Server-renders the CLIENT-SAFE
 * document model (no cost/margin/internal fields); the accept flow talks
 * to /api/qc/shared/[id]. Never indexed.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure Quotation — JM Equipment",
  robots: { index: false, follow: false },
};

function tokenMatches(expected: string | undefined, given: string): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function ClientQuotePage({ params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const state = await readQcState();
  const quote = state.quotes.find((q) => q.id === id);
  if (!quote || !tokenMatches(quote.token, token)) notFound();
  const machine = quote.machineId ? state.catalog.find((m) => m.id === quote.machineId) || null : null;
  const doc = buildDoc(quote, machine, state.settings);
  if (!doc) notFound();
  const canAccept = quote.status !== "accepted" && quote.status !== "won";
  return <ClientQuoteView id={id} token={token} initialDoc={doc} initialCanAccept={canAccept} />;
}
