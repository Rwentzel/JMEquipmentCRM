"use client";

/**
 * Dashboard (nav 00) — charcoal hero band, pipeline KPI stat grid, recent
 * quotes table, follow-ups, quick-start actions. Transcribed from the
 * design handoff markup; KPI math replicates the prototype's renderVals().
 */

import React from "react";
import type { QcApp } from "../useQcApp";
import type { QcQuote } from "@/lib/qc/types";
import { badgeCls, cashTotal, fmtDate, statusMeta, usd, usdShort, weightedTotal } from "@/lib/qc/logic";

export function DashView({ app }: { app: QcApp }) {
  const machineOf = (q: QcQuote) => app.machine(q.machineId);

  const open = app.quotes.filter((q) => q.status === "draft" || q.status === "sent");
  const pipelineValue = open.reduce((t, q) => t + cashTotal(q, machineOf(q)), 0);
  const wonish = app.quotes.filter((q) => q.status === "won" || q.status === "accepted");
  const lost = app.quotes.filter((q) => q.status === "lost");
  const winRate = wonish.length + lost.length > 0 ? Math.round((wonish.length / (wonish.length + lost.length)) * 100) : 0;
  const inFlight = app.quotes.filter((q) => q.status === "draft" || q.status === "sent" || q.status === "accepted");
  const weightedForecast = inFlight.reduce((t, q) => t + weightedTotal(q, machineOf(q)), 0);

  const stats = [
    { label: "Open Quotes", value: String(open.length), sub: "draft + sent" },
    { label: "Pipeline Value", value: usdShort(pipelineValue), sub: "gross open" },
    { label: "Weighted Forecast", value: usdShort(weightedForecast), sub: "probability-adjusted" },
    { label: "Win Rate", value: winRate + "%", sub: wonish.length + " won · " + lost.length + " lost" },
    { label: "Clients", value: String(app.clients.length), sub: "on file" },
  ];

  const recentQuotes = app.quotes
    .slice()
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 7)
    .map((q) => {
      const m = machineOf(q);
      const total = cashTotal(q, m);
      return {
        id: q.id,
        number: q.number,
        client: q.clientCompany,
        machineName: m ? m.name : "Parts Quote",
        totalStr: total > 0 ? usd(total) : "Consult",
        badgeCls: badgeCls(q.status),
        statusLabel: statusMeta(q.status).label,
      };
    });

  const fu = app.quotes
    .filter((q) => q.followUpDate && !q.followUpDone)
    .sort((a, b) => (a.followUpDate || "").localeCompare(b.followUpDate || ""));
  const today = new Date().toISOString().slice(0, 10);
  const followUps = fu.map((q) => {
    const overdue = (q.followUpDate || "") < today;
    return {
      id: q.id,
      number: q.number,
      note: q.followUpNote || "Follow up",
      due: (overdue ? "Overdue · " : "Due ") + fmtDate(q.followUpDate),
      dot: overdue ? "var(--jme-red)" : "var(--jme-gold)",
    };
  });

  return (
    <div style={{ padding: "34px 40px" }} data-screen-label="Dashboard">
      <div style={{ background: "var(--jme-charcoal)", color: "#fff", borderRadius: "var(--r-2)", padding: "30px 34px", marginBottom: "20px", boxShadow: "var(--sh-card)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "30px", flexWrap: "wrap" }}>
          <div style={{ maxWidth: "600px" }}>
            <div className="jme-eyebrow" style={{ color: "var(--jme-red-bright)" }}>JM Equipment · Quote Center</div>
            <h2 className="jme-h2" style={{ color: "#fff", fontSize: "40px", margin: "13px 0 0" }}>Built here. Quoted here.</h2>
            <p style={{ fontSize: "14.5px", color: "var(--paper-dim)", lineHeight: 1.6, margin: "11px 0 0" }}>
              Configure, send, and track firm written quotations for the full converting line — dual rotary sheeters, Martin rollstands, the JME-VCS core splitter, and the 24/7 parts desk. One floor in Sturgis, Michigan.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
              <button className="jme-btn jme-btn--sm" onClick={() => app.startQuote()}>+ New Quote</button>
              <button className="jme-btn jme-btn--ghost jme-btn--sm jme-btn--on-dark" onClick={() => app.go("equipment")}>Browse Equipment</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #3a3835", borderRadius: "var(--r-1)", overflow: "hidden", flex: "0 1 auto" }}>
            <div style={{ textAlign: "center", padding: "15px 22px", borderRight: "1px solid #3a3835" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "30px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                37<span style={{ fontSize: "15px", color: "var(--jme-red-bright)" }}> yr</span>
              </div>
              <div style={{ fontSize: "8.5px", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--paper-dim)", marginTop: "7px" }}>Since 1989</div>
            </div>
            <div style={{ textAlign: "center", padding: "15px 22px", borderRight: "1px solid #3a3835" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "30px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                3<span style={{ fontSize: "19px", color: "var(--jme-red-bright)" }}>×</span>
              </div>
              <div style={{ fontSize: "8.5px", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--paper-dim)", marginTop: "7px" }}>Cores / pallet</div>
            </div>
            <div style={{ textAlign: "center", padding: "15px 22px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "30px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>24/7</div>
              <div style={{ fontSize: "8.5px", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--paper-dim)", marginTop: "7px" }}>Parts desk</div>
            </div>
          </div>
        </div>
        <hr className="jme-chrome-rule" style={{ marginTop: "24px", border: 0 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "14px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid var(--hairline)", borderTop: "3px solid var(--jme-charcoal)", borderRadius: "var(--r-2)", padding: "19px 22px", boxShadow: "var(--sh-raise)" }}>
            <span style={{ display: "flex", alignItems: "center", fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)" }}>
              <span className="jme-diamond-bullet"></span>
              {s.label}
            </span>
            <b style={{ fontFamily: "var(--font-display)", fontSize: "42px", fontWeight: 800, color: "var(--ink-text)", lineHeight: 1, marginTop: "10px", display: "block", fontVariantNumeric: "tabular-nums" }}>{s.value}</b>
            <span style={{ fontSize: "11px", color: "var(--subtle)", display: "block", marginTop: "6px" }}>{s.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: "16px", alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "var(--r-2)", boxShadow: "var(--sh-raise)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "18px 22px", borderBottom: "1px solid var(--hairline)" }}>
            <h3 style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "18px", letterSpacing: ".04em", color: "var(--ink-text)", margin: 0 }}>Recent Quotes</h3>
            <a onClick={() => app.go("pipeline")} style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "12px", letterSpacing: ".06em", color: "var(--jme-red)", cursor: "pointer" }}>View Pipeline →</a>
          </div>
          <div className="jq-tbl scroll" style={{ "--minw": "440px", "--cols": "104px minmax(0,1.3fr) minmax(0,1.2fr) 86px 92px" } as React.CSSProperties}>
            <div className="jq-tr head"><div>Quote</div><div>Client</div><div>Machine</div><div className="r">Value</div><div className="r">Status</div></div>
            <div className="jq-body">
              {recentQuotes.map((q) => (
                <div key={q.id} className="jq-tr body clickable" onClick={() => app.editQuote(q.id)}>
                  <div className="jme-mono" style={{ color: "var(--jme-red)" }}>{q.number}</div>
                  <div>{q.client}</div>
                  <div className="sub">{q.machineName}</div>
                  <div className="r jme-mono">{q.totalStr}</div>
                  <div className="r"><span className={q.badgeCls}>{q.statusLabel}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "var(--r-2)", boxShadow: "var(--sh-raise)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "16px", letterSpacing: ".04em", color: "var(--ink-text)", margin: 0 }}>Follow-ups</h3>
              <span className="jme-mono" style={{ fontSize: "11px", color: "var(--muted)" }}>{fu.length}</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {followUps.map((f) => (
                <div key={f.id} onClick={() => app.editQuote(f.id)} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "11px 20px", borderBottom: "1px solid var(--hairline)", cursor: "pointer" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: f.dot, marginTop: "5px", flex: "none" }}></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "13px", color: "var(--ink-text)", lineHeight: 1.4 }}>{f.note}</div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}><span className="jme-mono">{f.number}</span> · {f.due}</div>
                  </div>
                </div>
              ))}
              {fu.length === 0 && <div style={{ padding: "22px 20px", textAlign: "center", color: "var(--subtle)", fontSize: "13px" }}>No follow-ups due. Pipeline is current.</div>}
            </div>
          </div>
          <div style={{ background: "var(--jme-charcoal)", borderRadius: "var(--r-2)", padding: "20px 22px", color: "#fff" }}>
            <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "14px", letterSpacing: ".08em", color: "var(--paper-dim)", marginBottom: "14px" }}>Quick Start</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              <button className="jme-btn jme-btn--sm jme-btn--block" onClick={() => app.startQuote()}>New Equipment Quote</button>
              <button className="jme-btn jme-btn--ghost jme-btn--sm jme-btn--block jme-btn--on-dark" onClick={() => app.go("equipment")}>Browse Equipment</button>
              <button className="jme-btn jme-btn--ghost jme-btn--sm jme-btn--block jme-btn--on-dark" onClick={() => app.go("parts")}>Parts Quote</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
