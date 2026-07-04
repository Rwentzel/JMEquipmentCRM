/**
 * Triage agent — prioritizes the open RFQ queue for the ops desk.
 *
 * Deterministic scoring always runs; when an ANTHROPIC_API_KEY is configured
 * it adds a short natural-language queue briefing. DATA PROTECTION: the LLM
 * receives only PII-FREE shapes (ref, age, counts, freight flag, status) —
 * never contact names, companies, emails, phones, or serials.
 */

import { aiAvailable, complete } from "@/lib/ai/provider";
import type { StoredRfq } from "@/lib/rfqStore";

export interface TriagedRfq {
  ref: string;
  score: number;
  reasons: string[];
}

export interface TriageReport {
  queue: TriagedRfq[];
  briefing: string;
  engine: "ai" | "rules";
}

const DAY_MS = 86_400_000;

/** Higher score = handle sooner. Pure and unit-testable. */
export function scoreRfq(rfq: StoredRfq, now: Date): TriagedRfq {
  const reasons: string[] = [];
  let score = 0;

  const ageDays = Math.max(0, (now.getTime() - Date.parse(rfq.createdAt)) / DAY_MS);
  if (ageDays >= 2) {
    score += 40;
    reasons.push(`waiting ${Math.floor(ageDays)}d — response SLA at risk`);
  } else if (ageDays >= 1) {
    score += 20;
    reasons.push("waiting over a day");
  }

  if (rfq.freight) {
    score += 15;
    reasons.push("freight quote required — carrier pricing takes longer");
  }

  const itemCount = rfq.items.reduce((n, it) => n + it.qty, 0);
  if (itemCount >= 10) {
    score += 20;
    reasons.push("large order volume");
  } else if (rfq.items.length >= 3) {
    score += 10;
    reasons.push("multi-line request");
  }

  if (rfq.status === "new") {
    score += 10;
    reasons.push("not yet reviewed");
  }

  if (reasons.length === 0) reasons.push("standard queue order");
  return { ref: rfq.ref, score, reasons };
}

/** Triage open (non-terminal) RFQs, highest priority first. */
export async function triageRfqs(rfqs: StoredRfq[], now = new Date()): Promise<TriageReport> {
  const open = rfqs.filter((r) => r.status === "new" || r.status === "reviewing");
  const queue = open.map((r) => scoreRfq(r, now)).sort((a, b) => b.score - a.score);

  let briefing =
    open.length === 0
      ? "Queue is clear — no open requests."
      : `${open.length} open request${open.length === 1 ? "" : "s"}; top of queue is ${queue[0]!.ref} (${queue[0]!.reasons[0]}).`;
  let engine: "ai" | "rules" = "rules";

  if (aiAvailable() && open.length > 0) {
    // PII-free projection only.
    const shape = open.map((r) => ({
      ref: r.ref,
      status: r.status,
      ageHours: Math.round((now.getTime() - Date.parse(r.createdAt)) / 3_600_000),
      lines: r.items.length,
      units: r.items.reduce((n, it) => n + it.qty, 0),
      freight: r.freight,
    }));
    const text = await complete({
      system:
        "You are an operations triage assistant for an industrial parts desk. Given a JSON queue of quote requests (no customer identity included), write a 2-3 sentence briefing: what to handle first and why, and anything aging past a one-business-day response target. Plain text, no markdown.",
      user: JSON.stringify(shape),
      maxTokens: 250,
    });
    if (text) {
      briefing = text;
      engine = "ai";
    }
  }

  return { queue, briefing, engine };
}
