"use client";

/**
 * ⌘K Global Search overlay — searches quotes, clients, and parts (6 hits
 * per group, like the prototype). Enter jumps to the first result; picking
 * a quote opens it in the builder, a client opens its record, a part jumps
 * to the parts catalog pre-filtered to it. Escape closes (global handler
 * in useQcApp).
 */

import React from "react";
import type { QcApp } from "./useQcApp";
import { badgeCls, cashTotal, statusMeta, usd } from "@/lib/qc/logic";

const HOVER_CSS = `
.qc-search-row:hover{background:var(--canvas-tint);border-left-color:var(--jme-red) !important;}
`;

const diamond = (color: string): React.CSSProperties => ({
  width: "9px",
  height: "9px",
  background: color,
  transform: "rotate(45deg)",
  flex: "none",
  display: "block",
  marginTop: "5px",
});

interface Row {
  key: string;
  iconStyle: React.CSSProperties;
  title: string;
  sub: string;
  isBadge: boolean;
  badgeCls: string;
  meta: string;
  pick: () => void;
}

export function SearchOverlay({ app }: { app: QcApp }) {
  if (!app.searchOpen) return null;

  const sq = (app.searchQuery || "").trim().toLowerCase();
  const groups: { label: string; countStr: string; items: Row[] }[] = [];
  if (sq) {
    const qm = app.quotes
      .filter((q) => {
        const m = app.machine(q.machineId);
        return (q.number + " " + q.clientCompany + " " + (m ? m.name + " " + m.sku : "parts") + " " + (q.clientContact || "") + " " + (q.po || "")).toLowerCase().indexOf(sq) >= 0;
      })
      .slice(0, 6);
    const cm = app.clients
      .filter((c) => ((c.company || "") + " " + (c.contact || "") + " " + (c.city || "") + " " + (c.industry || "") + " " + (c.email || "")).toLowerCase().indexOf(sq) >= 0)
      .slice(0, 6);
    const pm = app.parts
      .filter((p) => ((p.sku || "") + " " + (p.name || "") + " " + (p.fits || "") + " " + (p.cat || "") + " " + (p.fam || "")).toLowerCase().indexOf(sq) >= 0)
      .slice(0, 6);

    const qItems: Row[] = qm.map((q) => {
      const m = app.machine(q.machineId);
      return {
        key: "q" + q.id,
        iconStyle: diamond("var(--jme-red)"),
        title: q.number + "  ·  " + q.clientCompany,
        sub: (m ? m.name : "Parts / Components Quote") + " · " + (m ? m.sku : "PARTS"),
        isBadge: true,
        badgeCls: badgeCls(q.status),
        meta: statusMeta(q.status).label,
        pick: () => {
          app.closeSearch();
          app.editQuote(q.id);
        },
      };
    });
    const cItems: Row[] = cm.map((c) => {
      const qs = app.quotes.filter((x) => x.clientCompany === c.company);
      const val = qs.reduce((t, x) => t + cashTotal(x, app.machine(x.machineId)), 0);
      return {
        key: "c" + c.id,
        iconStyle: diamond("var(--jme-charcoal)"),
        title: c.company,
        sub: [c.contact, c.city].filter(Boolean).join(" · ") || "—",
        isBadge: false,
        badgeCls: "",
        meta: usd(val) + " · " + qs.length + "q",
        pick: () => {
          app.closeSearch();
          app.go("clients");
          app.selectClient(c.id);
        },
      };
    });
    const pItems: Row[] = pm.map((p) => ({
      key: "p" + p.sku,
      iconStyle: diamond("var(--jme-gold)"),
      title: p.name,
      sub: p.sku + " · fits " + p.fits,
      isBadge: false,
      badgeCls: "",
      meta: p.price > 0 ? usd(p.price) : "RFQ",
      pick: () => {
        app.closeSearch();
        app.go("parts");
        app.setPartQuery(p.name);
        app.setPartFam("All");
      },
    }));

    if (qItems.length) groups.push({ label: "Quotes", countStr: String(qm.length), items: qItems });
    if (cItems.length) groups.push({ label: "Clients", countStr: String(cm.length), items: cItems });
    if (pItems.length) groups.push({ label: "Parts", countStr: String(pm.length), items: pItems });
  }
  const first = groups[0]?.items[0]?.pick || null;
  const empty = groups.length === 0;
  const emptyMsg = sq ? "No matches for “" + app.searchQuery.trim() + "”" : "Search across quotes, clients, and parts.";

  return (
    <div
      data-print-hide
      onClick={app.closeSearch}
      style={{ position: "fixed", inset: 0, background: "rgba(10,10,12,.55)", zIndex: 70, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "78px 20px 20px" }}
    >
      <style>{HOVER_CSS}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="on-light"
        style={{ background: "var(--canvas)", borderRadius: "var(--r-2)", maxWidth: "620px", width: "100%", boxShadow: "var(--sh-doc)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "76vh" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "15px 20px", borderBottom: "1px solid var(--hairline)", flex: "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-3.2-3.2"></path>
          </svg>
          <input
            id="jmeGlobalSearch"
            autoFocus
            placeholder="Search quotes, clients, parts…"
            value={app.searchQuery}
            onChange={(e) => app.setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && first) first();
            }}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--ink-text)", padding: "2px 0" }}
          />
          <span className="jme-mono" style={{ fontSize: "9.5px", letterSpacing: ".06em", color: "var(--subtle)", border: "1px solid var(--hairline-2)", borderRadius: "3px", padding: "2px 6px", flex: "none" }}>ESC</span>
        </div>
        <div style={{ overflow: "auto", padding: "6px 0" }}>
          {groups.map((g) => (
            <div key={g.label} style={{ padding: "4px 0 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px 6px" }}>
                <span className="jme-eyebrow" style={{ margin: 0 }}>{g.label}</span>
                <span className="jme-mono" style={{ fontSize: "10px", color: "var(--subtle)" }}>{g.countStr}</span>
              </div>
              {g.items.map((r) => (
                <button
                  key={r.key}
                  onClick={r.pick}
                  className="qc-search-row"
                  style={{ display: "flex", alignItems: "flex-start", gap: "12px", width: "100%", textAlign: "left", background: "none", border: "none", borderLeft: "2px solid transparent", padding: "9px 20px", cursor: "pointer" }}
                >
                  <span style={r.iconStyle}></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "13.5px", color: "var(--ink-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
                    <span style={{ display: "block", fontSize: "11.5px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "1px" }}>{r.sub}</span>
                  </span>
                  {r.isBadge ? (
                    <span className={r.badgeCls} style={{ flex: "none" }}>{r.meta}</span>
                  ) : (
                    <span className="jme-mono" style={{ flex: "none", fontSize: "11.5px", color: "var(--muted)", whiteSpace: "nowrap" }}>{r.meta}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
          {empty && <div style={{ padding: "38px 20px", textAlign: "center", color: "var(--subtle)", fontSize: "13.5px" }}>{emptyMsg}</div>}
        </div>
      </div>
    </div>
  );
}
