"use client";

/**
 * Analytics view — pipeline health stats, value-by-stage and top-machine
 * bars, the probability-weighted forecast table, and loss reasons. All
 * aggregates are computed exactly like the prototype's derive() pass.
 */

import React from "react";
import type { QcApp } from "../useQcApp";
import { cashTotal, stageProb, statusMeta, usd, weightedTotal } from "@/lib/qc/logic";
import type { QcStatus } from "@/lib/qc/types";

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-2)",
  boxShadow: "var(--sh-raise)",
};

const h3: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  fontSize: "17px",
  letterSpacing: ".04em",
  color: "var(--ink-text)",
};

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...card, padding: "18px 20px" }}>
      <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</span>
      <b style={{ fontFamily: "var(--font-display)", fontSize: "30px", fontWeight: 800, color: color || "var(--ink-text)", display: "block", lineHeight: 1, marginTop: "8px" }}>{value}</b>
    </div>
  );
}

function Bar({ label, count, valueStr, barStyle }: { label: React.ReactNode; count: string; valueStr: string; barStyle: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "5px" }}>
        <span style={{ color: "var(--ink-text)", fontWeight: 600 }}>
          {label} <span style={{ color: "var(--subtle)", fontWeight: 400 }}>· {count}</span>
        </span>
        <span className="jme-mono" style={{ color: "var(--muted)" }}>{valueStr}</span>
      </div>
      <div style={{ height: "9px", background: "var(--canvas-tint)", borderRadius: "999px", overflow: "hidden" }}>
        <div style={barStyle}></div>
      </div>
    </div>
  );
}

export function AnalyticsView({ app }: { app: QcApp }) {
  const total = (q: (typeof app.quotes)[number]) => cashTotal(q, app.machine(q.machineId));

  const stOrder: QcStatus[] = ["draft", "sent", "accepted", "won", "lost"];
  const byStage = stOrder.map((s) => {
    const qs = app.quotes.filter((q) => q.status === s);
    const value = qs.reduce((t, q) => t + total(q), 0);
    return { label: statusMeta(s).label, count: qs.length, value, dot: statusMeta(s).dot };
  });
  const maxStage = Math.max(1, ...byStage.map((x) => x.value));

  const totalQuoted = app.quotes.reduce((t, q) => t + total(q), 0);
  const wonish = app.quotes.filter((q) => q.status === "won" || q.status === "accepted");
  const lost = app.quotes.filter((q) => q.status === "lost");
  const open = app.quotes.filter((q) => q.status === "draft" || q.status === "sent" || q.status === "accepted");
  const pipelineValue = open.reduce((t, q) => t + total(q), 0);
  const wonValue = wonish.reduce((t, q) => t + total(q), 0);
  const winRate = wonish.length + lost.length > 0 ? Math.round((wonish.length / (wonish.length + lost.length)) * 100) : 0;
  const avg = app.quotes.length ? totalQuoted / app.quotes.length : 0;
  const weightedForecast = open.reduce((t, q) => t + weightedTotal(q, app.machine(q.machineId)), 0);

  const mm: Record<string, { name: string; count: number; value: number }> = {};
  app.quotes.forEach((q) => {
    const m = app.machine(q.machineId);
    const name = m ? m.name : "Parts Quote";
    mm[name] = mm[name] || { name, count: 0, value: 0 };
    mm[name].count++;
    mm[name].value += total(q);
  });
  const byMachine = Object.values(mm).sort((a, b) => b.value - a.value).slice(0, 6);
  const maxM = Math.max(1, ...byMachine.map((x) => x.value));

  const forecastStages: QcStatus[] = ["draft", "sent", "accepted"];
  const forecastRows = forecastStages.map((s) => {
    const qs = app.quotes.filter((q) => q.status === s);
    const gross = qs.reduce((t, q) => t + total(q), 0);
    const prob = stageProb(s);
    return { label: statusMeta(s).label, count: String(qs.length), gross, probStr: Math.round(prob * 100) + "%", weighted: Math.round(gross * prob), dot: statusMeta(s).dot };
  });
  const forecastGross = forecastRows.reduce((t, r) => t + r.gross, 0);

  const lrMap: Record<string, number> = {};
  lost.forEach((q) => {
    const r = (q.lostReason && q.lostReason.trim()) || "Unspecified";
    lrMap[r] = (lrMap[r] || 0) + 1;
  });
  const lrKeys = Object.keys(lrMap).sort((a, b) => lrMap[b]! - lrMap[a]!);
  const lrMax = Math.max(1, ...lrKeys.map((k) => lrMap[k]!));

  return (
    <div style={{ padding: "34px 40px" }} data-screen-label="Analytics">
      <div style={{ marginBottom: "22px" }}>
        <div className="jme-eyebrow">Records</div>
        <h2 className="jme-h2" style={{ color: "var(--ink-text)", marginTop: "10px" }}>Quote Analytics</h2>
        <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "7px" }}>Pipeline health across all quotations.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "14px", marginBottom: "20px" }}>
        <Stat label="Total Quoted" value={usd(totalQuoted)} />
        <Stat label="Open Pipeline" value={usd(pipelineValue)} />
        <Stat label="Won Value" value={usd(wonValue)} color="var(--jme-green)" />
        <Stat label="Win Rate" value={winRate + "%"} />
        <Stat label="Avg Quote" value={usd(avg)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", alignItems: "start" }}>
        <div style={{ ...card, padding: "22px 24px" }}>
          <h3 style={{ ...h3, margin: "0 0 18px" }}>Value by Stage</h3>
          {byStage.map((s) => (
            <Bar
              key={s.label}
              label={s.label}
              count={String(s.count)}
              valueStr={usd(s.value)}
              barStyle={{ width: Math.max(2, Math.round((s.value / maxStage) * 100)) + "%", height: "100%", background: s.dot }}
            />
          ))}
        </div>
        <div style={{ ...card, padding: "22px 24px" }}>
          <h3 style={{ ...h3, margin: "0 0 18px" }}>Top Machines by Value</h3>
          {byMachine.map((m) => (
            <Bar
              key={m.name}
              label={m.name}
              count={String(m.count)}
              valueStr={usd(m.value)}
              barStyle={{ width: Math.max(3, Math.round((m.value / maxM) * 100)) + "%", height: "100%", background: "var(--jme-red)" }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "18px", alignItems: "start", marginTop: "18px" }}>
        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
            <h3 style={{ ...h3, margin: 0 }}>Weighted Forecast</h3>
            <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "10px", letterSpacing: ".14em", color: "var(--jme-gold)" }}>Probability-adjusted</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
            Open quotes weighted by stage close probability — a realistic view of pipeline value.
          </p>
          <div className="jq-tbl" style={{ "--cols": "minmax(0,1.3fr) minmax(0,.7fr) minmax(0,1fr) minmax(0,.7fr) minmax(0,1fr)" } as React.CSSProperties}>
            <div className="jq-tr head"><div>Stage</div><div className="r">Quotes</div><div className="r">Gross</div><div className="r">Prob.</div><div className="r">Weighted</div></div>
            <div className="jq-body">
              {forecastRows.map((f) => (
                <div className="jq-tr body" key={f.label}>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: f.dot, flex: "none" }}></span>
                      {f.label}
                    </span>
                  </div>
                  <div className="r sub">{f.count}</div>
                  <div className="r jme-mono">{usd(f.gross)}</div>
                  <div className="r sub">{f.probStr}</div>
                  <div className="r jme-mono" style={{ color: "var(--ink-text)", fontWeight: 700 }}>{usd(f.weighted)}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid var(--jme-charcoal)", marginTop: "4px", paddingTop: "13px" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "13px", letterSpacing: ".06em", color: "var(--ink-text)" }}>Forecast Total</span>
              <span style={{ fontSize: "11px", color: "var(--subtle)", marginLeft: "8px" }}>of {usd(forecastGross)} gross</span>
            </div>
            <span className="jme-mono" style={{ fontSize: "20px", fontWeight: 700, color: "var(--jme-red)" }}>{usd(weightedForecast)}</span>
          </div>
        </div>
        <div style={{ ...card, padding: "22px 24px" }}>
          <h3 style={{ ...h3, margin: "0 0 4px" }}>Loss Reasons</h3>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Why quotes were lost — set a reason on any quote marked lost.
          </p>
          {lrKeys.length > 0 ? (
            lrKeys.map((k) => (
              <div key={k} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "5px" }}>
                  <span style={{ color: "var(--ink-text)", fontWeight: 600 }}>{k}</span>
                  <span className="jme-mono" style={{ color: "var(--muted)" }}>{String(lrMap[k])}</span>
                </div>
                <div style={{ height: "9px", background: "var(--canvas-tint)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: Math.max(6, Math.round((lrMap[k]! / lrMax) * 100)) + "%", height: "100%", background: "var(--jme-red)", borderRadius: "999px" }}></div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--subtle)", fontSize: "13px" }}>No lost quotes on record.</div>
          )}
        </div>
      </div>
    </div>
  );
}
