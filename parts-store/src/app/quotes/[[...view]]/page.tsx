import type { Metadata } from "next";
import { cookies } from "next/headers";
import { OPS_COOKIE, opsMode, verifySession } from "@/lib/opsAuth";
import { OpsLogin } from "@/components/ops/OpsLogin";
import { QuoteCenterApp } from "@/components/qc/QuoteCenterApp";
import { PARTS_MASTER } from "@/lib/qc/partsMaster";
import { readQcState } from "@/lib/qc/store";

/**
 * JME Quote Center — INTERNAL sales quoting system (design handoff
 * implementation). Same gate as /ops: OPS_TOKEN session required in
 * production, open with a banner in dev. Never indexed.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quote Center — JM Equipment",
  robots: { index: false, follow: false },
};

const VIEWS = ["dash", "pipeline", "builder", "equipment", "parts", "clients", "analytics", "settings"] as const;
export type QcView = (typeof VIEWS)[number];

export default async function QuoteCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ view?: string[] }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const mode = opsMode();
  if (mode === "disabled") {
    return (
      <main className="ops-gate">
        <h1>Quote Center is disabled</h1>
        <p>
          Set the <code>OPS_TOKEN</code> environment variable to enable the internal console. Tokens are never stored
          in the repository.
        </p>
      </main>
    );
  }
  const authed = verifySession((await cookies()).get(OPS_COOKIE)?.value);
  if (mode !== "dev-open" && !authed) return <OpsLogin />;

  const seg = (await params).view?.[0] ?? "dash";
  const view: QcView = (VIEWS as readonly string[]).includes(seg) ? (seg as QcView) : "dash";
  const state = await readQcState();
  // ?q=<id> deep-links straight into a quote — how "Create quote" on the ops
  // desk hands the rep the draft it just built from an RFQ.
  const wanted = (await searchParams).q;
  const initialQuoteId = wanted && state.quotes.some((x) => x.id === wanted) ? wanted : null;
  return (
    <QuoteCenterApp initialView={view} initialState={state} parts={PARTS_MASTER} initialQuoteId={initialQuoteId} />
  );
}
