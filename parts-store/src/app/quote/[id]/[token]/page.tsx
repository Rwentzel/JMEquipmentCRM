import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcceptPanel } from "@/components/qc/AcceptPanel";
import { QuoteDoc } from "@/components/qc/QuoteDoc";
import { getQcState, getQuoteByToken } from "@/lib/qc/store";

/**
 * Customer quote page — the "written quote" the RFQ-first policy promises.
 * Reachable ONLY with the quote's unguessable share token (constant-time
 * checked); always noindexed; shows sell pricing for this customer's own
 * quotation, never cost/margin. Accept records a typed signature.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your JM Equipment Quotation",
  robots: { index: false, follow: false },
};

export default async function CustomerQuotePage({ params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const quote = await getQuoteByToken(id, token);
  if (!quote) notFound();
  const state = await getQcState();
  const machine = quote.machineId ? state.catalog.find((m) => m.id === quote.machineId) ?? null : null;
  const accepted = quote.status === "accepted" || quote.status === "won";

  return (
    <main className="qview">
      <div className="qview__bar">
        <span>Quotation {quote.number} · {state.settings.company}</span>
        <span className="qview__baractions">
          {accepted ? <b className="qview__ok">Accepted ✓</b> : <span>Review below, then accept or reply by email</span>}
        </span>
      </div>
      <div className="qview__paper">
        <QuoteDoc quote={quote} machine={machine} settings={state.settings} />
      </div>
      <AcceptPanel id={quote.id} token={quote.shareToken} accepted={accepted} deskPhone={state.settings.phone} deskEmail={state.settings.email} />
    </main>
  );
}
