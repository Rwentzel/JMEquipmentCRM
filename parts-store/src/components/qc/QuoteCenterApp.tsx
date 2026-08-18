"use client";

/**
 * JME Quote Center — app shell, ported pixel-faithfully from the design
 * handoff (JME Quote Center.dc.html). Fixed dark sidebar (240px) with the
 * numbered nav groups, light canvas main that switches between the eight
 * views, plus the global toast, loss-reason modal, and ⌘K search overlay.
 */

import React from "react";
import "@/styles/qc.css";
import { useQcApp } from "./useQcApp";
import type { QcApp, QcView } from "./useQcApp";
import type { QcPart, QcState } from "@/lib/qc/types";
import { LOSS_REASONS } from "@/lib/qc/labels";
import { SearchOverlay } from "./SearchOverlay";
import { DashView } from "./views/DashView";
import { PipelineView } from "./views/PipelineView";
import { BuilderView } from "./views/BuilderView";
import { EquipmentView } from "./views/EquipmentView";
import { PartsView } from "./views/PartsView";
import { ClientsView } from "./views/ClientsView";
import { AnalyticsView } from "./views/AnalyticsView";
import { SettingsView } from "./views/SettingsView";

const NAV_GROUPS: { label: string; items: { n: string; label: string; id: QcView }[] }[] = [
  { label: "Workspace", items: [{ n: "00", label: "Dashboard", id: "dash" }, { n: "01", label: "Quote Pipeline", id: "pipeline" }] },
  { label: "Quoting", items: [{ n: "02", label: "New Quote", id: "builder" }, { n: "03", label: "Equipment", id: "equipment" }, { n: "04", label: "Parts", id: "parts" }] },
  { label: "Records", items: [{ n: "05", label: "Clients", id: "clients" }, { n: "06", label: "Analytics", id: "analytics" }] },
  { label: "System", items: [{ n: "07", label: "Settings", id: "settings" }] },
];

const SHELL_CSS = `
.qc-nav-it{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:transparent;border:none;font-family:var(--font-display);text-transform:uppercase;font-size:15px;font-weight:600;letter-spacing:.04em;color:#b0b0b6;padding:9px 10px;border-radius:var(--r-1);cursor:pointer;margin-bottom:1px;}
.qc-nav-it:hover{background:#1c1c20;color:#fff;}
.qc-nav-it.on{background:var(--jme-red);color:#fff;}
.qc-nav-it.on:hover{background:var(--jme-red);color:#fff;}
.qc-nav-num{font-family:var(--font-mono);font-size:10px;color:#5c5c61;letter-spacing:0;flex:none;min-width:16px;}
.qc-nav-it.on .qc-nav-num{color:rgba(255,255,255,.7);}
.qc-search-trigger:hover{border-color:#3a3a40 !important;color:#c8c8cc !important;}
.qc-sort-head:hover{color:#fff !important;}
`;

function LossModal({ app }: { app: QcApp }) {
  const lm = app.lossModal;
  if (!lm) return null;
  const lossNumber = (app.quotes.find((x) => x.id === lm.id) || { number: "" }).number || "";
  return (
    <div
      data-print-hide
      onClick={app.closeLoss}
      style={{ position: "fixed", inset: 0, background: "rgba(10,10,12,.72)", zIndex: 60, display: "grid", placeItems: "center", padding: "20px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="on-light"
        style={{ background: "var(--canvas)", borderRadius: "var(--r-2)", maxWidth: "440px", width: "100%", boxShadow: "var(--sh-doc)", overflow: "hidden" }}
      >
        <div style={{ background: "var(--jme-charcoal)", color: "#fff", padding: "18px 24px" }}>
          <div className="jme-eyebrow" style={{ color: "var(--jme-red-bright)" }}>Mark Quote Lost</div>
          <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "22px", letterSpacing: ".04em", marginTop: "8px" }}>{lossNumber}</div>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "13.5px", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 16px" }}>
            Record why this quote was lost. Reasons roll up into the win/loss analytics.
          </p>
          <div className="jme-field" style={{ marginBottom: "20px" }}>
            <label className="jme-field__label">Loss Reason</label>
            <select className="jme-select" value={lm.reason} onChange={(e) => app.setLossReason(e.target.value)}>
              <option value="">— Select reason —</option>
              {LOSS_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={app.closeLoss}>Cancel</button>
            <button className="jme-btn jme-btn--sm" onClick={app.confirmLoss}>Mark Lost</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuoteCenterApp({
  initialView,
  initialState,
  parts,
  initialQuoteId = null,
}: {
  initialView: QcView;
  initialState: QcState;
  parts: QcPart[];
  initialQuoteId?: string | null;
}) {
  const app = useQcApp(initialView, initialState, parts, initialQuoteId);
  return (
    <>
      <style>{SHELL_CSS}</style>
      <div className="qc-shell" style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
        <nav
          className="qc-sidebar"
          style={{
            background: "var(--ink-2)",
            color: "#c8c8cc",
            padding: "22px 16px",
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #000",
            overflow: "auto",
          }}
        >
          <div className="qc-brand" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "2px 8px 20px", borderBottom: "1px solid #2a2a2e", marginBottom: "18px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/jme-diamond-cut.png" alt="JME" style={{ width: "34px", height: "auto", display: "block" }} />
            <div>
              <b style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "18px", letterSpacing: ".05em", color: "#fff", display: "block", lineHeight: 1 }}>JM Equipment</b>
              <small style={{ fontSize: "8px", letterSpacing: ".24em", textTransform: "uppercase", color: "#7d7d82", display: "block", marginTop: "4px" }}>Quote Center</small>
            </div>
          </div>
          <button
            onClick={app.openSearch}
            className="qc-search-trigger"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              width: "100%",
              background: "#1c1c20",
              border: "1px solid #2a2a2e",
              borderRadius: "var(--r-1)",
              color: "#8a8a90",
              padding: "9px 11px",
              cursor: "pointer",
              marginBottom: "18px",
              textAlign: "left",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-3.2-3.2"></path>
            </svg>
            <span style={{ flex: 1, fontSize: "13px", letterSpacing: ".01em" }}>Search…</span>
            <span className="jme-mono" style={{ fontSize: "9px", letterSpacing: ".06em", color: "#5c5c61", border: "1px solid #33333a", borderRadius: "3px", padding: "2px 5px" }}>⌘K</span>
          </button>
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="qc-navgroup" style={{ marginBottom: "16px" }}>
              <div className="qc-navgroup-label" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase", color: "#5c5c61", padding: "0 8px 8px" }}>{g.label}</div>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  className={"qc-nav-it" + (app.view === it.id ? " on" : "")}
                  onClick={() => {
                    if (it.id === "builder") app.navNewQuote();
                    else app.go(it.id);
                  }}
                >
                  <span className="qc-nav-num">{it.n}</span>
                  {it.label}
                </button>
              ))}
            </div>
          ))}
          <div className="qc-sidefoot" style={{ marginTop: "auto", padding: "14px 8px 0", borderTop: "1px solid #2a2a2e", display: "flex", flexDirection: "column", gap: "4px" }}>
            <button onClick={() => app.startQuote()} className="jme-btn jme-btn--sm jme-btn--block" style={{ marginBottom: "8px" }}>+ New Quote</button>
            <div style={{ fontSize: "8.5px", letterSpacing: ".14em", textTransform: "uppercase", color: "#7d7d82", lineHeight: 1.5, marginBottom: "3px" }}>Converting Machinery Solutions</div>
            <span className="jme-mono" style={{ fontSize: "9.5px", color: "var(--jme-gold)", letterSpacing: ".08em" }}>Sturgis, MI · Est. 1989</span>
            <span style={{ fontSize: "9.5px", color: "#838389", letterSpacing: ".04em" }}>(269) 659-0093 · sales@jmequipment.net</span>
          </div>
        </nav>

        <main className="on-light qc-main" style={{ minHeight: "100vh", minWidth: 0, background: "var(--canvas-tint)" }}>
          {app.view === "dash" && <DashView app={app} />}
          {app.view === "pipeline" && <PipelineView app={app} />}
          {app.view === "builder" && <BuilderView app={app} />}
          {app.view === "equipment" && <EquipmentView app={app} />}
          {app.view === "parts" && <PartsView app={app} />}
          {app.view === "clients" && <ClientsView app={app} />}
          {app.view === "analytics" && <AnalyticsView app={app} />}
          {app.view === "settings" && <SettingsView app={app} />}
        </main>
      </div>

      <LossModal app={app} />
      <SearchOverlay app={app} />

      {app.toast && (
        <div
          className={"jme-toast" + (app.toast.tone === "green" ? " jme-toast--green" : "")}
          style={{
            position: "fixed",
            left: "50%",
            bottom: "28px",
            transform: "translateX(-50%)",
            zIndex: 9999,
            textTransform: "uppercase",
            animation: "jmeToastIn .2s var(--ease)",
          }}
        >
          {app.toast.msg}
        </div>
      )}
    </>
  );
}
