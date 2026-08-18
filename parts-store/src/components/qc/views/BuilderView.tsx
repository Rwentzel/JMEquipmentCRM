"use client";

/**
 * Quote Builder — left white form aside (client, machine, configurator,
 * pricing, addons, parts, ROI, follow-up, notes, internal margin) + right
 * live preview column with the quote document scaled to fit.
 * Transcribed from the design handoff (qc_markup.html, Quote Builder screen).
 */

import { useEffect, useRef } from "react";
import type { QcApp } from "@/components/qc/useQcApp";
import { LOSS_REASONS } from "@/lib/qc/labels";
import {
  actDot,
  actLabel,
  badgeCls,
  buildDoc,
  deriveActivity,
  fmtDate,
  priceBreak,
  resolvedSku,
  resolvedSubtitle,
  statusMeta,
  usd,
} from "@/lib/qc/logic";
import { QuoteDoc } from "@/components/qc/QuoteDoc";
import { NumberInput } from "@/components/NumberInput";

function cfgChipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "3px",
    padding: "8px 13px",
    borderRadius: "var(--r-1)",
    cursor: "pointer",
    border: "1px solid " + (active ? "var(--jme-red)" : "var(--hairline-2)"),
    background: active ? "var(--jme-red)" : "#fff",
    color: active ? "#fff" : "var(--ink-text)",
    minWidth: "54px",
  };
}

const smallGhostBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--hairline-2)",
  color: "var(--jme-red)",
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  fontSize: "11px",
  letterSpacing: ".05em",
  padding: "4px 9px",
  borderRadius: "var(--r-1)",
  cursor: "pointer",
};

const removeBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--hairline-2)",
  color: "var(--muted)",
  borderRadius: "var(--r-1)",
  cursor: "pointer",
  fontSize: "15px",
  lineHeight: 1,
  height: "34px",
};

const linkActionStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--paper-dim)",
  fontSize: "11px",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  fontFamily: "var(--font-display)",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  padding: 0,
};

export function BuilderView({ app }: { app: QcApp }) {
  const colRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bq = app.bq;

  // Prototype auto-starts a blank quote when the builder opens without one.
  useEffect(() => {
    if (!app.bq) app.startQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit-to-column zoom, exactly the prototype's fitStage(col, stage, 790).
  useEffect(() => {
    const fit = () => {
      const col = colRef.current;
      const stage = stageRef.current;
      if (!col || !stage) return;
      const z = Math.max(0.34, Math.min(1, (col.clientWidth - 40) / 790));
      stage.style.setProperty("zoom", String(z));
    };
    fit();
    window.addEventListener("resize", fit);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && colRef.current) {
      ro = new ResizeObserver(fit);
      ro.observe(colRef.current);
    }
    return () => {
      window.removeEventListener("resize", fit);
      if (ro) ro.disconnect();
    };
  }, [bq]);

  if (!bq) return null;

  const bqM = app.machine(bq.machineId);
  const meta = statusMeta(bq.status);
  const pb = priceBreak(bq, bqM);
  const cfg = (bqM && bqM.cfg) || null;
  const hasConfig = !!cfg;
  const summaryRows: { label: string; amount: string; style: React.CSSProperties }[] = [
    { label: "Subtotal", amount: usd(pb.subtotal), style: {} },
  ];
  if (pb.discount > 0)
    summaryRows.push({
      label: bq.discMode === "pct" ? "Discount " + (+(bq.discPct || 0)) + "%" : "Discount",
      amount: "−" + usd(pb.discount),
      style: { color: "var(--jme-red)" },
    });
  if (pb.tariff > 0) summaryRows.push({ label: "Import tariff " + pb.tariffPct + "%", amount: usd(pb.tariff), style: {} });
  if (pb.freight > 0) summaryRows.push({ label: "Freight", amount: usd(pb.freight), style: {} });
  if (pb.tax > 0) summaryRows.push({ label: "Tax " + pb.taxPct + "%", amount: usd(pb.tax), style: {} });
  const marginColor = pb.marginPct >= 25 ? "var(--jme-green)" : pb.marginPct >= 15 ? "var(--jme-gold)" : "var(--jme-red)";
  const marginStr = pb.afterDisc > 0 ? pb.marginPct + "%" : "—";
  const totalStr = pb.total > 0 ? usd(pb.total) : "Consult";
  const activity = deriveActivity(bq).slice().reverse();
  const doc = buildDoc(bq, bqM, app.settings);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "392px 1fr", height: "100vh" }} data-screen-label="Quote Builder">
      <aside style={{ background: "#fff", borderRight: "1px solid var(--hairline)", overflow: "auto", height: "100vh" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "18px 20px",
            borderBottom: "1px solid var(--hairline)",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/jme-diamond-cut.png" alt="JME" style={{ width: "28px", display: "block" }} />
            <div>
              <b
                style={{
                  fontFamily: "var(--font-display)",
                  textTransform: "uppercase",
                  fontSize: "16px",
                  letterSpacing: ".04em",
                  display: "block",
                  lineHeight: 1,
                  color: "var(--ink-text)",
                }}
              >
                Quote Builder
              </b>
              <small style={{ fontSize: "11px", color: "var(--muted)" }} className="jme-mono">
                {bq.number}
              </small>
            </div>
          </div>
          <span className={badgeCls(bq.status)}>{meta.label}</span>
        </div>
        <div style={{ padding: "20px" }}>
          <div className="jme-eyebrow" style={{ marginBottom: "12px" }}>Quote</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Status</label>
              <select className="jme-select" value={bq.status} onChange={(e) => app.setBq("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Valid (days)</label>
              <NumberInput className="jme-input" value={bq.validity} onChange={(n) => app.setBq("validity", n)} />
            </div>
          </div>

          {bq.status === "lost" && (
            <div className="jme-field" style={{ marginTop: "14px" }}>
              <label className="jme-field__label" style={{ color: "var(--jme-red)" }}>Loss Reason</label>
              <select className="jme-select" value={bq.lostReason || ""} onChange={(e) => app.setBq("lostReason", e.target.value)}>
                <option value="">— Select reason —</option>
                {LOSS_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          <div className="jme-eyebrow" style={{ margin: "20px 0 12px" }}>Machine</div>
          <div className="jme-field">
            <label className="jme-field__label">Equipment</label>
            <select className="jme-select" value={bq.machineId ?? ""} onChange={(e) => app.onMachineChange(e.target.value)}>
              {app.catalog.map((m) => (
                <option key={m.id} value={m.id}>{m.name + " — " + m.sku}</option>
              ))}
            </select>
          </div>

          {hasConfig && cfg && (
            <>
              <div className="jme-eyebrow" style={{ margin: "22px 0 12px" }}>{cfg.title || "Configuration"}</div>
              {(cfg.axes || []).map((ax) => (
                <div key={ax.key} style={{ marginBottom: "15px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      marginBottom: "8px",
                    }}
                  >
                    {ax.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {(ax.options || []).map((o) => {
                      const active = (bq.config || {})[ax.key] === o.v;
                      let sub = "";
                      if (o.consult) sub = "Consult";
                      else if (o.note) sub = o.note;
                      else if (ax.priced && o.base != null) sub = usd(o.base);
                      return (
                        <button key={o.v} onClick={() => app.pickConfig(ax.key, o.v)} style={cfgChipStyle(active)}>
                          <span
                            style={{
                              fontFamily: "var(--font-display)",
                              textTransform: "uppercase",
                              fontSize: "14px",
                              letterSpacing: ".03em",
                              lineHeight: 1,
                            }}
                          >
                            {o.label}
                          </span>
                          <span style={{ fontSize: "10px", letterSpacing: ".02em", color: active ? "rgba(255,255,255,.85)" : "var(--muted)" }}>
                            {sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(cfg.options || []).length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      margin: "6px 0 4px",
                    }}
                  >
                    Optional Add-ons
                  </div>
                  {(cfg.options || []).map((o) => (
                    <label
                      key={o.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "7px 0",
                        borderBottom: "1px solid var(--hairline)",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "var(--ink-text)",
                      }}
                    >
                      <input type="checkbox" checked={(bq.cfgOpts || []).indexOf(o.key) >= 0} onChange={() => app.toggleCfgOpt(o.key)} />
                      <span style={{ flex: 1 }}>{o.label}</span>
                      <span className="jme-mono" style={{ fontSize: "12px", color: "var(--jme-red)" }}>{"+" + usd(o.amount)}</span>
                    </label>
                  ))}
                </>
              )}
              <div
                className="jme-mono"
                style={{
                  marginTop: "12px",
                  fontSize: "11px",
                  color: "var(--jme-gold)",
                  letterSpacing: ".04em",
                  background: "var(--canvas-tint)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--r-1)",
                  padding: "9px 12px",
                }}
              >
                {resolvedSku(bq, bqM) + "  ·  " + resolvedSubtitle(bq, bqM)}
              </div>
            </>
          )}

          <div className="jme-eyebrow" style={{ margin: "20px 0 12px" }}>Customer</div>
          <div className="jme-field" style={{ marginBottom: "12px" }}>
            <label className="jme-field__label">Load Existing Client</label>
            <select className="jme-select" value="" onChange={(e) => app.loadClientInto(e.target.value)}>
              <option value="">— Select client —</option>
              {app.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          </div>
          <div className="jme-field" style={{ marginBottom: "12px" }}>
            <label className="jme-field__label">Company</label>
            <input
              className="jme-input"
              value={bq.clientCompany}
              onChange={(e) => app.setBq("clientCompany", e.target.value)}
              placeholder="Acme Container Corp."
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Contact</label>
              <input className="jme-input" value={bq.clientContact} onChange={(e) => app.setBq("clientContact", e.target.value)} />
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Department</label>
              <input className="jme-input" value={bq.clientDept} onChange={(e) => app.setBq("clientDept", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">City / State</label>
              <input className="jme-input" value={bq.clientCity} onChange={(e) => app.setBq("clientCity", e.target.value)} />
            </div>
            <div className="jme-field">
              <label className="jme-field__label">PO Number</label>
              <input className="jme-input" value={bq.po} onChange={(e) => app.setBq("po", e.target.value)} />
            </div>
          </div>
          <div className="jme-field" style={{ marginBottom: "10px" }}>
            <label className="jme-field__label">Email</label>
            <input
              className="jme-input"
              type="email"
              value={bq.clientEmail}
              onChange={(e) => app.setBq("clientEmail", e.target.value)}
              placeholder="buyer@company.com"
            />
          </div>
          <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={app.saveClientFromBq} style={{ fontSize: "12px" }}>
            Save as client
          </button>

          <div className="jme-eyebrow" style={{ margin: "22px 0 12px" }}>Pricing</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Base Equipment ($)</label>
              <NumberInput className="jme-input" value={bq.base} onChange={(n) => app.setBq("base", n)} />
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Crating ($)</label>
              <NumberInput className="jme-input" value={bq.crating} onChange={(n) => app.setBq("crating", n)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Payment</label>
              <select className="jme-select" value={bq.payment} onChange={(e) => app.setBq("payment", e.target.value)}>
                <option value="50-50">50% PO / 50% Ship</option>
                <option value="30-60-10">30 / 60 / 10</option>
                <option value="net30">Net 30</option>
              </select>
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Lead Time</label>
              <input className="jme-input" value={bq.lead} onChange={(e) => app.setBq("lead", e.target.value)} />
            </div>
          </div>
          <div className="jme-field" style={{ marginBottom: "8px" }}>
            <label className="jme-field__label">Warranty</label>
            <input className="jme-input" value={bq.warranty} onChange={(e) => app.setBq("warranty", e.target.value)} />
          </div>

          <div className="jme-eyebrow" style={{ margin: "22px 0 12px" }}>Adjustments</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Discount Type</label>
              <select className="jme-select" value={bq.discMode || "amt"} onChange={(e) => app.setBq("discMode", e.target.value)}>
                <option value="amt">Flat ($)</option>
                <option value="pct">Percent (%)</option>
              </select>
            </div>
            {bq.discMode === "pct" ? (
              <div className="jme-field">
                <label className="jme-field__label">Discount (%)</label>
                <NumberInput
                  className="jme-input"
                  min={0}
                  max={100}
                  value={bq.discPct ?? 0}
                  onChange={(n) => app.setBq("discPct", n)}
                />
              </div>
            ) : (
              <div className="jme-field">
                <label className="jme-field__label">Discount ($)</label>
                <NumberInput
                  className="jme-input"
                  min={0}
                  value={bq.discAmt ?? 0}
                  onChange={(n) => app.setBq("discAmt", n)}
                />
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Freight Estimate ($)</label>
              <NumberInput className="jme-input" min={0} value={bq.freight ?? 0} onChange={(n) => app.setBq("freight", n)} />
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Import Tariff (%)</label>
              <NumberInput className="jme-input" min={0} value={bq.tariffPct ?? 0} onChange={(n) => app.setBq("tariffPct", n)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Sales Tax (%)</label>
              <NumberInput className="jme-input" min={0} value={bq.taxPct ?? 0} onChange={(n) => app.setBq("taxPct", n)} />
            </div>
            <div className="jme-field">
              <label className="jme-field__label" style={{ color: "var(--jme-gold)" }}>Your Cost ($) · internal</label>
              <NumberInput className="jme-input" min={0} value={bq.cost ?? 0} onChange={(n) => app.setBq("cost", n)} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px" }}>
            <div className="jme-eyebrow" style={{ margin: 0 }}>Custom Add-ons</div>
            <button onClick={app.addAddon} style={smallGhostBtn}>+ Add</button>
          </div>
          {(bq.addons || []).map((a, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 92px 30px", gap: "7px", marginBottom: "7px", alignItems: "center" }}>
              <input
                className="jme-input"
                placeholder="Option label"
                value={a.label}
                onChange={(e) => app.setAddon(i, "label", e.target.value)}
                style={{ padding: "7px 9px" }}
              />
              <NumberInput
                className="jme-input"
                placeholder="$"
                value={a.amount}
                onChange={(n) => app.setAddon(i, "amount", n)}
                style={{ padding: "7px 9px", textAlign: "right" }}
              />
              <button onClick={() => app.removeAddon(i)} style={removeBtn}>×</button>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px" }}>
            <div className="jme-eyebrow" style={{ margin: 0 }}>Parts &amp; Components</div>
            <button onClick={() => app.go("parts")} style={smallGhostBtn}>Browse parts</button>
          </div>
          {(bq.parts || []).map((p, i) => (
            <div key={p.sku} style={{ display: "grid", gridTemplateColumns: "1fr 56px 30px", gap: "7px", marginBottom: "7px", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "12.5px", color: "var(--ink-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
                <div className="jme-mono" style={{ fontSize: "10px", color: "var(--jme-red)" }}>
                  {p.rfq ? "RFQ" : usd(p.price) + " ea"}
                </div>
              </div>
              <NumberInput
                className="jme-input"
                min={1}
                value={p.qty}
                onChange={(n) => app.setPartQty(i, Math.max(1, n))}
                style={{ padding: "7px 9px", textAlign: "right" }}
              />
              <button onClick={() => app.removePart(i)} style={removeBtn}>×</button>
            </div>
          ))}
          {!(bq.parts || []).length && (
            <div style={{ fontSize: "12px", color: "var(--subtle)", padding: "2px 0 4px" }}>No parts added.</div>
          )}

          {!!(bqM && bqM.roi) && (
            <>
              <div className="jme-eyebrow" style={{ margin: "22px 0 12px" }}>ROI Inputs</div>
              <label
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  fontSize: "13px",
                  color: "var(--ink-text)",
                  marginBottom: "12px",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={!!bq.roiOn} onChange={(e) => app.setBq("roiOn", e.target.checked)} /> Include ROI summary in quote
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="jme-field">
                  <label className="jme-field__label">Cores / day</label>
                  <NumberInput className="jme-input" value={bq.roiCores} onChange={(n) => app.setBq("roiCores", n)} />
                </div>
                <div className="jme-field">
                  <label className="jme-field__label">Days / year</label>
                  <NumberInput className="jme-input" value={bq.roiDays} onChange={(n) => app.setBq("roiDays", n)} />
                </div>
              </div>
            </>
          )}

          <div className="jme-eyebrow" style={{ margin: "22px 0 12px" }}>Follow-up</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "12px", alignItems: "end" }}>
            <div className="jme-field">
              <label className="jme-field__label">Reminder Date</label>
              <input className="jme-input" type="date" value={bq.followUpDate} onChange={(e) => app.setBq("followUpDate", e.target.value)} />
            </div>
            <label
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                fontSize: "13px",
                color: "var(--ink-text)",
                cursor: "pointer",
                paddingBottom: "9px",
                whiteSpace: "nowrap",
              }}
            >
              <input type="checkbox" checked={!!bq.followUpDone} onChange={(e) => app.setBq("followUpDone", e.target.checked)} /> Done
            </label>
          </div>
          <div className="jme-field" style={{ marginBottom: "4px" }}>
            <label className="jme-field__label">Reminder Note</label>
            <input
              className="jme-input"
              value={bq.followUpNote}
              onChange={(e) => app.setBq("followUpNote", e.target.value)}
              placeholder="e.g. Call buyer re: install schedule"
            />
          </div>

          <div className="jme-eyebrow" style={{ margin: "22px 0 12px" }}>Internal Notes</div>
          <textarea
            className="jme-textarea"
            rows={3}
            value={bq.notes}
            onChange={(e) => app.setBq("notes", e.target.value)}
            placeholder="Not shown on the client quote."
            style={{ resize: "vertical" }}
          />

          <div className="jme-eyebrow" style={{ margin: "24px 0 10px" }}>Quote Summary</div>
          <div style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-2)", overflow: "hidden" }}>
            <div style={{ padding: "12px 15px", background: "var(--canvas-tint)", borderBottom: "1px solid var(--hairline)" }}>
              {summaryRows.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "3px 0" }}>
                  <span style={{ color: "var(--muted)" }}>{r.label}</span>
                  <b className="jme-mono" style={r.style}>{r.amount}</b>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 15px" }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: ".16em",
                  color: "var(--jme-gold)",
                }}
              >
                Est. Margin · internal
              </span>
              <span className="jme-mono" style={{ fontSize: "13px", color: marginColor }}>
                {marginStr} · {usd(pb.marginAmt)}
              </span>
            </div>
          </div>
          {activity.length > 0 && (
            <>
              <div className="jme-eyebrow" style={{ margin: "24px 0 8px" }}>Activity</div>
              <div>
                {activity.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--hairline)" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: actDot(e.type), flex: "none" }}></span>
                    <span style={{ fontSize: "12.5px", color: "var(--ink-text)", flex: 1 }}>{actLabel(e)}</span>
                    <span className="jme-mono" style={{ fontSize: "11px", color: "var(--subtle)" }}>{fmtDate(e.date)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "var(--jme-charcoal)",
            borderTop: "1px solid #000",
            padding: "13px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "9px",
            zIndex: 3,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                textTransform: "uppercase",
                fontSize: "12px",
                letterSpacing: ".12em",
                color: "var(--paper-dim)",
              }}
            >
              Total Quote
            </span>
            <span className="jme-mono" style={{ fontSize: "22px", fontWeight: 700, color: "#fff" }}>{totalStr}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="jme-btn jme-btn--sm" onClick={() => app.saveQuote()} style={{ flex: 1 }}>Save</button>
            <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={app.previewClient} style={{ flex: 1 }}>Preview</button>
            <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={app.sendCurrent} style={{ flex: 1 }}>Send</button>
          </div>
          {/* Link controls only make sense once the quote exists in the
              pipeline — an unsaved draft has no link to share or revoke. */}
          {app.quotes.some((q) => q.id === bq.id) && (
            <div style={{ display: "flex", gap: "14px", marginTop: "10px", justifyContent: "center" }}>
              <button onClick={() => app.copyLink(bq.id)} style={linkActionStyle}>Copy client link</button>
              <button onClick={() => app.reissueLink(bq.id)} style={linkActionStyle} title="Invalidate the link already sent and issue a new one">
                Reissue link
              </button>
            </div>
          )}
        </div>
      </aside>
      <div id="builderPreviewCol" ref={colRef} style={{ background: "#33312e", overflow: "auto", height: "100vh" }}>
        <div style={{ minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "26px 18px 60px" }}>
          <div id="builderPreviewStage" ref={stageRef} style={{ width: "790px", flex: "none" }}>
            {doc && <QuoteDoc doc={doc} />}
          </div>
        </div>
      </div>
    </div>
  );
}
