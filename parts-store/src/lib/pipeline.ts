/**
 * Pipeline math for the ops desk — pure functions, safe for client import.
 *
 * Stage weights follow the JME quote-pipeline model: a draft (reviewing)
 * quote closes ~25% of the time, a sent (quoted) quote ~55%; won is booked
 * revenue, not forecast. Amounts come only from staff-entered quote totals —
 * this module never sees the public catalog and involves no customer PII.
 */

export interface PipelineRow {
  status: string;
  total?: string;
}

const STAGE_WEIGHT: Record<string, number> = {
  reviewing: 0.25,
  quoted: 0.55,
};

/** "$1,480.00" → 1480 ; "RFQ"/empty/garbage → null. */
export function parseMoney(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 10_000) return "$" + Math.round(n / 1000) + "K";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export interface PipelineStats {
  openCount: number;
  openValue: number;
  weightedForecast: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  winRate: number | null;
}

export function pipelineStats(rows: PipelineRow[]): PipelineStats {
  let openCount = 0;
  let openValue = 0;
  let weightedForecast = 0;
  let wonCount = 0;
  let wonValue = 0;
  let lostCount = 0;

  for (const r of rows) {
    const amount = parseMoney(r.total);
    if (r.status === "won") {
      wonCount += 1;
      if (amount) wonValue += amount;
    } else if (r.status === "lost") {
      lostCount += 1;
    } else if (r.status !== "archived") {
      openCount += 1;
      if (amount) {
        openValue += amount;
        weightedForecast += amount * (STAGE_WEIGHT[r.status] ?? 0.1);
      }
    }
  }

  const decided = wonCount + lostCount;
  return {
    openCount,
    openValue,
    weightedForecast: Math.round(weightedForecast),
    wonCount,
    wonValue,
    lostCount,
    winRate: decided > 0 ? Math.round((wonCount / decided) * 100) : null,
  };
}
