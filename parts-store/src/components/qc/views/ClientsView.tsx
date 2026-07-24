"use client";

/**
 * Clients (nav 05) — client card list + editable detail panel with notes,
 * per-client quote history, "start quote for client" and delete.
 * Transcribed from the design handoff markup; card/detail assembly
 * replicates the prototype's clientCards/selClient view-model.
 */

import React from "react";
import type { QcApp } from "../useQcApp";
import type { QcQuote } from "@/lib/qc/types";
import { badgeCls, cashTotal, statusMeta, usd } from "@/lib/qc/logic";

export function ClientsView({ app }: { app: QcApp }) {
  const machineOf = (q: QcQuote) => app.machine(q.machineId);

  const clientCards = app.clients.map((c) => {
    const qs = app.quotes.filter((q) => q.clientCompany === c.company);
    const val = qs.reduce((t, q) => t + cashTotal(q, machineOf(q)), 0);
    return {
      id: c.id,
      company: c.company,
      contact: c.contact || "—",
      city: c.city || "—",
      industry: c.industry || "—",
      quoteCount: String(qs.length),
      valueStr: usd(val),
      borderColor: app.clientId === c.id ? "var(--jme-red)" : "var(--hairline)",
    };
  });

  const selC = app.clients.find((c) => c.id === app.clientId) || null;
  const selQuotes = selC
    ? app.quotes
        .filter((q) => q.clientCompany === selC.company)
        .map((q) => {
          const m = machineOf(q);
          const total = cashTotal(q, m);
          return {
            id: q.id,
            number: q.number,
            machineName: m ? m.name : "Parts Quote",
            totalStr: total > 0 ? usd(total) : "Consult",
            badgeCls: badgeCls(q.status),
            statusLabel: statusMeta(q.status).label,
          };
        })
    : [];

  return (
    <div style={{ padding: "34px 40px" }} data-screen-label="Clients">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <div className="jme-eyebrow">Records</div>
          <h2 className="jme-h2" style={{ color: "var(--ink-text)", marginTop: "10px" }}>Client Database</h2>
          <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "7px" }}>Accounts, contacts, and the quotes tied to each.</div>
        </div>
        <button className="jme-btn jme-btn--sm" onClick={app.addClient}>+ Add Client</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "18px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {clientCards.map((c) => (
            <button
              key={c.id}
              onClick={() => app.selectClient(c.id)}
              style={{
                textAlign: "left",
                background: "#fff",
                border: "1px solid " + c.borderColor,
                borderRadius: "var(--r-2)",
                boxShadow: "var(--sh-raise)",
                padding: "16px 18px",
                cursor: "pointer",
                display: "block",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
                <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "17px", letterSpacing: ".03em", color: "var(--ink-text)" }}>{c.company}</div>
                <span className="jme-mono" style={{ fontSize: "11px", color: "var(--jme-red)" }}>{c.valueStr}</span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{c.contact} · {c.city}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <span className="jme-tag" style={{ color: "var(--muted)", borderColor: "var(--hairline-2)" }}>{c.industry}</span>
                <span style={{ fontSize: "11px", color: "var(--subtle)" }}>{c.quoteCount} quotes</span>
              </div>
            </button>
          ))}
        </div>
        {selC && (
          <div style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "var(--r-2)", boxShadow: "var(--sh-raise)", overflow: "hidden" }}>
            <div style={{ background: "var(--jme-charcoal)", color: "#fff", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="jme-eyebrow" style={{ color: "var(--jme-red-bright)" }}>Client Record</div>
                <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "24px", letterSpacing: ".03em", marginTop: "8px" }}>{selC.company}</div>
              </div>
              <button
                onClick={() => app.deleteClient(selC.id)}
                style={{
                  background: "none",
                  border: "1px solid #4a3537",
                  color: "var(--paper-dim)",
                  borderRadius: "var(--r-1)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "var(--font-display)",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  padding: "6px 11px",
                }}
              >
                Remove
              </button>
            </div>
            <div style={{ padding: "22px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div className="jme-field">
                  <label className="jme-field__label">Company</label>
                  <input className="jme-input" value={selC.company} onChange={(e) => app.setClientField("company", e.target.value)} />
                </div>
                <div className="jme-field">
                  <label className="jme-field__label">Contact</label>
                  <input className="jme-input" value={selC.contact} onChange={(e) => app.setClientField("contact", e.target.value)} />
                </div>
                <div className="jme-field">
                  <label className="jme-field__label">Email</label>
                  <input className="jme-input" value={selC.email} onChange={(e) => app.setClientField("email", e.target.value)} />
                </div>
                <div className="jme-field">
                  <label className="jme-field__label">Phone</label>
                  <input className="jme-input" value={selC.phone} onChange={(e) => app.setClientField("phone", e.target.value)} />
                </div>
                <div className="jme-field">
                  <label className="jme-field__label">City / State</label>
                  <input className="jme-input" value={selC.city} onChange={(e) => app.setClientField("city", e.target.value)} />
                </div>
                <div className="jme-field">
                  <label className="jme-field__label">Industry</label>
                  <input className="jme-input" value={selC.industry} onChange={(e) => app.setClientField("industry", e.target.value)} />
                </div>
              </div>
              <div className="jme-field" style={{ marginBottom: "18px" }}>
                <label className="jme-field__label">Notes</label>
                <textarea className="jme-textarea" rows={2} value={selC.notes} onChange={(e) => app.setClientField("notes", e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--hairline)", paddingTop: "16px" }}>
                <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "15px", letterSpacing: ".04em", color: "var(--ink-text)" }}>Quotes</div>
                <button className="jme-btn jme-btn--sm" onClick={() => app.startQuoteForClient(selC.id)}>+ New Quote</button>
              </div>
              {selQuotes.length > 0 && (
                <div className="jq-tbl scroll" style={{ marginTop: "12px", "--minw": "420px", "--cols": "104px minmax(0,1.4fr) 86px 92px" } as React.CSSProperties}>
                  <div className="jq-tr head"><div>Quote</div><div>Machine</div><div className="r">Value</div><div className="r">Status</div></div>
                  <div className="jq-body">
                    {selQuotes.map((q) => (
                      <div key={q.id} className="jq-tr body clickable" onClick={() => app.editQuote(q.id)}>
                        <div className="jme-mono" style={{ color: "var(--jme-red)" }}>{q.number}</div>
                        <div className="sub">{q.machineName}</div>
                        <div className="r jme-mono">{q.totalStr}</div>
                        <div className="r"><span className={q.badgeCls}>{q.statusLabel}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selQuotes.length === 0 && <div style={{ padding: "16px 0 2px", color: "var(--subtle)", fontSize: "13px" }}>No quotes yet for this client.</div>}
            </div>
          </div>
        )}
        {!selC && (
          <div style={{ background: "#fff", border: "1px dashed var(--hairline-2)", borderRadius: "var(--r-2)", padding: "50px", textAlign: "center", color: "var(--subtle)", fontSize: "14px" }}>
            Select a client to view details and their quotes.
          </div>
        )}
      </div>
    </div>
  );
}
