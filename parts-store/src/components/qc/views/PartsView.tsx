"use client";

/**
 * Parts Catalog view — searchable/filterable window over the 1,892-row
 * parts master, ported pixel-faithfully from the design handoff. Rows are
 * capped at 60 like the prototype, with the "Showing X of Y" note.
 */

import React from "react";
import type { QcApp } from "../useQcApp";
import { stockBadge, usd } from "@/lib/qc/logic";

const PART_CAP = 60;

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

export function PartsView({ app }: { app: QcApp }) {
  const fams = ["All", ...Array.from(new Set(app.parts.map((p) => p.fam)))];
  const pq = (app.partQuery || "").toLowerCase();
  const partsMatch = app.parts.filter(
    (p) =>
      (app.partFam === "All" || p.fam === app.partFam) &&
      (!pq || (p.sku + " " + p.name + " " + p.fits + " " + p.cat).toLowerCase().indexOf(pq) >= 0),
  );
  const rows = partsMatch.slice(0, PART_CAP);
  const more = partsMatch.length > rows.length;
  const countNote =
    partsMatch.length === 0
      ? "No parts match your search."
      : "Showing " +
        rows.length +
        " of " +
        partsMatch.length.toLocaleString("en-US") +
        (more ? " matching parts — refine the search or pick a category to narrow." : " matching parts.");

  return (
    <div style={{ padding: "34px 40px" }} data-screen-label="Parts Catalog">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "18px", flexWrap: "wrap" }}>
        <div>
          <div className="jme-eyebrow">Quoting</div>
          <h2 className="jme-h2" style={{ color: "var(--ink-text)", marginTop: "10px" }}>Parts Catalog</h2>
          <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "7px" }}>
            1,900+ genuine and refurbished parts across rollstands, sheeters, core splitters, brakes, and web handling —
            most stocked in Sturgis. Search or filter by system, then add line items to the active quote.
          </div>
        </div>
        {app.bq && (
          <button className="jme-btn jme-btn--sm" onClick={app.navNewQuote}>Open Quote Builder</button>
        )}
      </div>
      <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
        <input
          className="jme-input"
          placeholder="Search parts, SKU, machine…"
          value={app.partQuery}
          onChange={(e) => app.setPartQuery(e.target.value)}
          style={{ maxWidth: "320px" }}
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {fams.map((f) => (
            <button key={f} onClick={() => app.setPartFam(f)} style={chipStyle(app.partFam === f)}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>{countNote}</div>
      <div style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "var(--r-2)", boxShadow: "var(--sh-raise)", overflow: "hidden" }}>
        <div className="jq-tbl scroll" style={{ "--minw": "700px", "--cols": "126px minmax(0,1.5fr) minmax(0,1fr) 108px 72px 72px" } as React.CSSProperties}>
          <div className="jq-tr head"><div>SKU</div><div>Part</div><div>Fits</div><div>Availability</div><div className="r">Price</div><div className="r">Add</div></div>
          <div className="jq-body">
            {rows.map((p) => (
              <div className="jq-tr body" key={p.sku}>
                <div className="jme-mono" style={{ color: "var(--jme-red)" }}>{p.sku}</div>
                <div className="wrap">
                  {p.name}
                  <div className="sub" style={{ fontSize: "11px" }}>{p.cat}</div>
                </div>
                <div className="sub">{p.fits}</div>
                <div><span className={stockBadge(p.stock)}>{p.stock}</span></div>
                <div className="r jme-mono">{p.price > 0 ? usd(p.price) : "RFQ"}</div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="jme-btn jme-btn--sm" onClick={() => app.addPartToQuote(p.sku)} style={{ padding: "5px 12px", fontSize: "12px" }}>+ Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
