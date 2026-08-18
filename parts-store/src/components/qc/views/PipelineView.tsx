"use client";

/**
 * Quote Pipeline (nav 01) — filter chips with counts, search, sortable
 * table with sort carets, expiry badges, inline status select, and row
 * actions (preview / email / copy link / duplicate). Transcribed from the
 * design handoff markup; row/chip/column assembly replicates renderVals().
 */

import React from "react";
import type { QcApp } from "../useQcApp";
import type { QcQuote } from "@/lib/qc/types";
import { badgeCls, cashTotal, expiryInfo, fmtDate, sortQuotes, usd } from "@/lib/qc/logic";

const chipStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: ".04em",
  padding: "7px 14px",
  borderRadius: "var(--r-1)",
  cursor: "pointer",
  border: "1px solid " + (active ? "var(--jme-red)" : "var(--hairline-2)"),
  background: active ? "var(--jme-red)" : "#fff",
  color: active ? "#fff" : "var(--muted)",
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  whiteSpace: "nowrap",
});

const pipeHeadStyle = (align: string, sortable: boolean, active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  justifyContent: align === "right" ? "flex-end" : "flex-start",
  cursor: sortable ? "pointer" : "default",
  userSelect: "none",
  color: active ? "#fff" : "rgba(255,255,255,.66)",
});

const actBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--hairline-2)",
  color: "var(--muted)",
  borderRadius: "var(--r-1)",
  cursor: "pointer",
  fontSize: "11px",
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  letterSpacing: ".04em",
  padding: "5px 9px",
};

const PIPE_HEAD_DEFS: [string | null, string, string][] = [
  ["number", "Quote", "left"],
  ["client", "Client", "left"],
  ["machine", "Machine", "left"],
  ["created", "Created", "left"],
  ["value", "Value", "right"],
  ["status", "Status", "left"],
  [null, "Actions", "right"],
];

export function PipelineView({ app }: { app: QcApp }) {
  const machineOf = (q: QcQuote) => app.machine(q.machineId);
  const pf = app.pipeFilter;
  const pquery = (app.pipeQuery || "").toLowerCase();

  let pipeList = app.quotes
    .filter((q) => pf === "All" || q.status === pf)
    .filter((q) => {
      if (!pquery) return true;
      const m = machineOf(q);
      return (q.number + " " + q.clientCompany + " " + (m ? m.name : "parts") + " " + (q.clientContact || "")).toLowerCase().indexOf(pquery) >= 0;
    });
  pipeList = sortQuotes(pipeList, app.pipeSort, machineOf);

  const pipeRows = pipeList.map((q) => {
    const m = machineOf(q);
    const total = cashTotal(q, m);
    const exp = expiryInfo(q);
    let showExp = false;
    let expTxt = "";
    let expCls = "jme-badge";
    if (exp.active) {
      if (exp.expired) {
        showExp = true;
        expTxt = "Expired";
        expCls = "jme-badge jme-badge--out";
      } else if (exp.daysLeft != null && exp.daysLeft <= 14) {
        showExp = true;
        expTxt = exp.daysLeft + "d left";
        expCls = "jme-badge jme-badge--lead";
      }
    }
    return {
      q,
      id: q.id,
      number: q.number,
      status: q.status,
      client: q.clientCompany,
      machineName: m ? m.name : "Parts Quote",
      totalStr: total > 0 ? usd(total) : "Consult",
      dateStr: fmtDate(q.createdAt),
      showExp,
      expTxt,
      expCls,
    };
  });

  const psort = app.pipeSort || { key: "created", dir: "desc" };
  const pipeCols = PIPE_HEAD_DEFS.map((d) => {
    const key = d[0];
    const active = !!key && psort.key === key;
    return {
      key,
      label: d[1],
      sortable: !!key,
      active,
      indicator: active ? (psort.dir === "asc" ? "▲" : "▼") : "",
      headStyle: pipeHeadStyle(d[2], !!key, active),
    };
  });

  const pchip = (label: string, val: string) => ({
    label,
    val,
    active: pf === val,
    count: String(val === "All" ? app.quotes.length : app.quotes.filter((q) => q.status === val).length),
    style: chipStyle(pf === val),
  });
  const pipeChips = [pchip("All", "All"), pchip("Draft", "draft"), pchip("Sent", "sent"), pchip("Accepted", "accepted"), pchip("Won", "won"), pchip("Lost", "lost")];

  return (
    <div style={{ padding: "34px 40px" }} data-screen-label="Quote Pipeline">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <div className="jme-eyebrow">Workspace</div>
          <h2 className="jme-h2" style={{ color: "var(--ink-text)", marginTop: "10px" }}>Quote Pipeline</h2>
          <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "7px" }}>Track every quotation from draft to close. Click a quote to open it in the builder.</div>
        </div>
        <button className="jme-btn jme-btn--sm" onClick={() => app.startQuote()}>+ New Quote</button>
      </div>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
        <input
          className="jme-input"
          placeholder="Search quotes, clients, machines…"
          value={app.pipeQuery}
          onChange={(e) => app.setPipeQuery(e.target.value)}
          style={{ maxWidth: "340px" }}
        />
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
        {pipeChips.map((c) => (
          <button key={c.val} onClick={() => app.setPipeFilter(c.val)} style={c.style}>
            {c.label}
            <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: "11px" }}>{c.count}</span>
          </button>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "var(--r-2)", boxShadow: "var(--sh-raise)", overflow: "hidden" }}>
        {/* Actions column is 264px (not the design's 194px) because this port adds a
            fifth action, Delete — at 194px the row overflowed under the status select. */}
        <div className="jq-tbl scroll" style={{ "--minw": "930px", "--cols": "104px minmax(0,1fr) minmax(0,0.9fr) 90px 80px 110px 264px" } as React.CSSProperties}>
          <div className="jq-tr head">
            {pipeCols.map((c) => (
              <div
                key={c.label}
                className={c.sortable ? "qc-sort-head" : undefined}
                onClick={c.key ? () => app.setPipeSort(c.key!) : undefined}
                style={c.headStyle}
              >
                {c.label}
                <span style={{ fontSize: "9px", lineHeight: 1 }}>{c.indicator}</span>
              </div>
            ))}
          </div>
          <div className="jq-body">
            {pipeRows.map((r) => (
              <div key={r.id} className="jq-tr body">
                <div className="jme-mono" style={{ color: "var(--jme-red)", cursor: "pointer" }} onClick={() => app.editQuote(r.id)}>{r.number}</div>
                <div onClick={() => app.editQuote(r.id)} style={{ cursor: "pointer" }}>{r.client}</div>
                <div className="sub">{r.machineName}</div>
                <div className="sub wrap">
                  {r.dateStr}
                  {r.showExp && (
                    <div style={{ marginTop: "5px" }}>
                      <span className={r.expCls}>{r.expTxt}</span>
                    </div>
                  )}
                </div>
                <div className="r jme-mono">{r.totalStr}</div>
                <div>
                  <select
                    className="jme-select"
                    aria-label={`Status for quote ${r.id}`}
                    value={r.status}
                    onChange={(e) => app.onPipeStatus(r.id, e.target.value)}
                    style={{ padding: "5px 26px 5px 9px", fontSize: "12px", width: "auto" }}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                  <button onClick={() => app.openClientView(r.id)} title="Client preview" style={actBtnStyle}>View</button>
                  <button onClick={() => app.emailQuote(r.q)} title="Email draft" style={actBtnStyle}>Email</button>
                  <button onClick={() => app.copyLink(r.id)} title="Copy client link" style={actBtnStyle}>Link</button>
                  <button onClick={() => app.duplicateQuote(r.id)} title="Duplicate / revise" style={actBtnStyle}>Revise</button>
                  <button
                    onClick={() => app.confirmDeleteQuote(r.id)}
                    title="Delete quote"
                    style={{ ...actBtnStyle, color: "var(--jme-red)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
