import type { CSSProperties } from "react";
import type { QuoteDocModel } from "@/lib/qc/types";

/**
 * JME Quote Doc — the client-facing quote document, transcribed 1:1 from the
 * design handoff ("JME Quote Doc.dc.html"). Pure presentational: renders the
 * CLIENT-SAFE QuoteDocModel and nothing else, so it works in server
 * components, the ops builder preview, and the shared client view alike.
 */

/** The prototype's photoStyle, derived from the model's photo path/data-URL. */
function photoStyle(photo: string): CSSProperties {
  return {
    backgroundImage: `url("${photo}")`,
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    width: "82%",
    height: "230px",
    filter: "drop-shadow(0 14px 24px rgba(0,0,0,.22))",
  };
}

export function QuoteDoc({ doc }: { doc: QuoteDocModel }) {
  return (
    <div
      id="jme-print-doc"
      className="on-light"
      style={{ maxWidth: "790px", margin: "0 auto", background: "var(--canvas)", boxShadow: "var(--sh-doc)", color: "var(--ink-text)", fontFamily: "var(--font-body)" }}
    >
      <div style={{ background: "var(--jme-charcoal)", color: "#fff", padding: "22px 38px", display: "flex", justifyContent: "space-between", alignItems: "center", breakInside: "avoid" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/jme-diamond-cut.png" alt="JME" style={{ width: "44px", height: "auto", display: "block" }} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "21px", letterSpacing: ".05em", lineHeight: 1, fontWeight: 700 }}>JM Equipment Inc.</div>
            <div style={{ fontSize: "8.5px", letterSpacing: ".26em", textTransform: "uppercase", color: "var(--paper-dim)", marginTop: "4px" }}>Converting Machinery Solutions · Est. 1989</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--paper-dim)" }}>Quotation</div>
          <div className="jme-mono" style={{ fontSize: "21px", color: "#fff", letterSpacing: ".05em", marginTop: "3px" }}>{doc.number}</div>
        </div>
      </div>

      <div style={{ padding: "32px 38px 6px", position: "relative" }}>
        {doc.accepted && (
          <div style={{ position: "absolute", top: "26px", right: "34px", transform: "rotate(-9deg)", border: "3px solid var(--jme-green)", color: "var(--jme-green)", fontFamily: "var(--font-display)", textTransform: "uppercase", fontWeight: 800, fontSize: "26px", letterSpacing: ".06em", padding: "6px 18px", borderRadius: "var(--r-1)", opacity: 0.92 }}>Accepted</div>
        )}
        <div className="jme-eyebrow">{doc.kicker}</div>
        <h1 className="jme-h1" style={{ fontSize: "42px", margin: "13px 0 5px", color: "var(--ink-text)" }}>{doc.machineName}</h1>
        <div style={{ fontSize: "14px", color: "var(--muted)", letterSpacing: ".01em" }}>{doc.machineSubtitle} · {doc.sku}</div>

        {doc.hasPhoto && (
          <div style={{ margin: "24px 0 8px", height: "270px", display: "grid", placeItems: "center", background: "#fbfbfa", border: "1px solid var(--hairline-2)", borderRadius: "var(--r-1)", overflow: "hidden" }}>
            <div style={photoStyle(doc.photo)}></div>
          </div>
        )}
        {!doc.hasPhoto && (
          <div style={{ margin: "24px 0 8px", height: "200px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "#fbfbfa", border: "1px solid var(--hairline-2)", borderRadius: "var(--r-1)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/jme-diamond-cut.png" alt="JME" style={{ width: "74px", opacity: 0.5, display: "block" }} />
            <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "11px", letterSpacing: ".2em", color: "var(--subtle)" }}>Photography available on request</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", padding: "22px 0", borderTop: "1px solid var(--hairline)" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Prepared For</div>
            <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "21px", letterSpacing: ".03em", color: "var(--ink-text)" }}>{doc.client.company}</div>
            <div style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.55, marginTop: "4px" }}>{doc.client.line}</div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>From</div>
            <div style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.55 }}>{doc.company.name}<br />{doc.company.addr}<br />{doc.company.phone} · {doc.company.email}</div>
            <div style={{ fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--subtle)", marginTop: "8px" }}>FOB {doc.fob} · Valid {doc.validity} days · through {doc.validUntil}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px", background: "var(--hairline)", border: "1px solid var(--hairline)", borderRadius: "var(--r-1)", overflow: "hidden" }}>
          {doc.badges.map((b, i) => (
            <div key={i} style={{ background: "var(--canvas-tint)", padding: "16px 12px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "18px", letterSpacing: ".03em", color: "var(--jme-red)" }}>{b.b}</div>
              <div style={{ fontSize: "9px", letterSpacing: ".13em", textTransform: "uppercase", color: "var(--muted)", marginTop: "5px" }}>{b.s}</div>
            </div>
          ))}
        </div>

        {doc.consultation && (
          <div style={{ background: "var(--panel)", borderLeft: "3px solid var(--jme-gold)", borderRadius: "var(--r-1)", padding: "12px 16px", fontSize: "12px", fontWeight: 600, color: "var(--ink-text)", letterSpacing: ".01em", marginTop: "18px" }}>QUICK QUOTE — pricing provided by consultation. Full written quotation available on request.</div>
        )}
      </div>

      <div style={{ padding: "26px 38px", breakBefore: "page" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid var(--jme-charcoal)", paddingBottom: "12px", marginBottom: "18px" }}>
          <div className="jme-eyebrow">Equipment Specifications</div>
          <span className="jme-mono" style={{ fontSize: "12px", color: "var(--jme-gold)", letterSpacing: ".12em" }}>{doc.sku}</span>
        </div>
        <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 18px", maxWidth: "640px" }}>{doc.desc}</p>
        <div className="jq-tbl" style={{ marginBottom: "20px", breakInside: "avoid", "--cols": "minmax(0,1fr) minmax(0,1.2fr)" } as CSSProperties}>
          <div className="jq-tr head"><div>Specification</div><div className="r">Value</div></div>
          <div className="jq-body">
            {doc.specs.map((s, i) => (
              <div className="jq-tr body" key={i}><div>{s.k}</div><div className="r jme-mono">{s.v}</div></div>
            ))}
          </div>
        </div>
        {doc.hasPackage && (
          <div style={{ background: "var(--panel)", borderRadius: "var(--r-1)", padding: "18px 20px", breakInside: "avoid" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)" }}>Standard Package Includes</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px 24px", marginTop: "13px" }}>
              {doc.package.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", fontSize: "13px", color: "var(--ink-text)" }}><span className="jme-diamond-bullet"></span>{p.t}</div>
              ))}
            </div>
          </div>
        )}
        <div style={{ background: "var(--panel)", borderLeft: "3px solid var(--jme-red)", borderRadius: "var(--r-1)", padding: "16px 20px", marginTop: "18px", breakInside: "avoid" }}>
          <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "14px", letterSpacing: ".1em", fontWeight: 700, color: "var(--jme-red)", marginBottom: "6px" }}>Why JM Equipment</div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>Built, rebuilt, and parts-supported under one roof in Sturgis, Michigan since 1989 — with a Michigan phone number behind every machine. Rebuilt to tighter-than-original spec; pressure-tested to 150% of operating.</p>
        </div>
      </div>

      <div style={{ padding: "26px 38px", breakBefore: "page" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid var(--jme-charcoal)", paddingBottom: "12px", marginBottom: "18px" }}>
          <div className="jme-eyebrow">Pricing Summary</div>
          <span className="jme-mono" style={{ fontSize: "12px", color: "var(--jme-gold)", letterSpacing: ".12em" }}>{doc.number}</span>
        </div>
        <div style={{ borderTop: "2px solid var(--ink-text)", breakInside: "avoid" }}>
          {doc.pricing.rows.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--hairline)", fontSize: "14px" }}><span style={{ color: "var(--muted)" }}>{r.label}</span><b className="jme-mono">{r.amount}</b></div>
          ))}
          {doc.pricing.totals.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 2px", borderBottom: "1px solid var(--hairline)", fontSize: "13px" }}><span style={{ color: "var(--muted)", letterSpacing: ".02em" }}>{t.label}</span><b className="jme-mono" style={t.red ? { color: "var(--jme-red)" } : undefined}>{t.amount}</b></div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "13px 2px", borderTop: "2px solid var(--ink-text)", marginTop: "4px" }}>
            <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, fontSize: "16px", color: "var(--ink-text)" }}>{doc.pricing.totalLabel}</span>
            <b className="jme-mono" style={{ fontSize: "22px", color: "var(--ink-text)" }}>{doc.pricing.total}</b>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", margin: "24px 0", breakInside: "avoid" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>Payment Schedule</div>
            {doc.pricing.payment.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--hairline)", fontSize: "13.5px" }}><span style={{ color: "var(--muted)" }}>{p.label}</span><b className="jme-mono">{p.amount}</b></div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>Lead Time / Warranty</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--hairline)", fontSize: "13.5px" }}><span style={{ color: "var(--muted)" }}>Lead Time</span><b>{doc.pricing.leadTime}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--hairline)", fontSize: "13.5px" }}><span style={{ color: "var(--muted)" }}>Warranty</span><b>{doc.pricing.warranty}</b></div>
          </div>
        </div>
        {doc.roi.show && (
          <>
            <div style={{ margin: "6px 0 14px", background: "#fbfbfa", border: "1px solid var(--hairline-2)", borderRadius: "var(--r-1)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "18px", breakInside: "avoid" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/pallet-before-after.png" alt="Core densification — 3x cores per pallet" style={{ height: "118px", maxWidth: "52%", objectFit: "contain", display: "block" }} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "17px", letterSpacing: ".04em", color: "var(--ink-text)", lineHeight: 1.05 }}>3× the cores.<br />Same pallet.</div>
                <p style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.55, margin: "7px 0 0" }}>The JME-VCS densifies spent cores so one pallet ships what used to take three — cutting freight and disposal on every load.</p>
              </div>
            </div>
            <div style={{ background: "var(--jme-charcoal)", borderRadius: "var(--r-2)", padding: "22px 26px", color: "#fff", margin: "6px 0 20px", breakInside: "avoid" }}>
              <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "13px", letterSpacing: ".1em", color: "var(--paper-dim)", marginBottom: "16px" }}>{doc.roi.head}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px" }}>
                <div><b className="jme-mono" style={{ fontSize: "30px", fontWeight: 800, color: "#fff", display: "block", lineHeight: 1 }}>{doc.roi.annual}</b><span style={{ fontSize: "10px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--jme-red-bright)", display: "block", marginTop: "8px" }}>Est. Annual Savings</span></div>
                <div><b className="jme-mono" style={{ fontSize: "30px", fontWeight: 800, color: "#fff", display: "block", lineHeight: 1 }}>{doc.roi.payback}</b><span style={{ fontSize: "10px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--jme-red-bright)", display: "block", marginTop: "8px" }}>Payback Period</span></div>
                <div><b className="jme-mono" style={{ fontSize: "30px", fontWeight: 800, color: "#fff", display: "block", lineHeight: 1 }}>{doc.roi.net5}</b><span style={{ fontSize: "10px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--jme-red-bright)", display: "block", marginTop: "8px" }}>5-Year Net</span></div>
              </div>
            </div>
          </>
        )}
        {doc.hasDisclosures && (
          <>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)" }}>Important Disclosures</div>
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
              {doc.disclosures.map((d, i) => (
                <li key={i} style={{ position: "relative", fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5, padding: "4px 0 4px 16px" }}><span style={{ position: "absolute", left: 0, color: "var(--jme-red)" }}>•</span>{d.t}</li>
              ))}
            </ul>
          </>
        )}
        {doc.hasEstimates && (
          <p style={{ fontSize: "10.5px", color: "var(--subtle)", marginTop: "12px", lineHeight: 1.6 }}>{doc.roiDisclaimer}</p>
        )}
      </div>

      <div style={{ padding: "26px 38px 32px", breakBefore: "page" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid var(--jme-charcoal)", paddingBottom: "12px", marginBottom: "18px" }}>
          <div className="jme-eyebrow">Terms &amp; Conditions</div>
          <span className="jme-mono" style={{ fontSize: "12px", color: "var(--jme-gold)", letterSpacing: ".12em" }}>{doc.number}</span>
        </div>
        <ol style={{ margin: "0 0 26px", paddingLeft: "20px" }}>
          {doc.terms.map((t, i) => (
            <li key={i} style={{ fontSize: "12.5px", color: "var(--ink-text)", lineHeight: 1.6, padding: "5px 0" }}><b style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: ".03em", fontSize: "13px" }}>{t.t}.</b> {t.d}</li>
          ))}
        </ol>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)" }}>Authorized Signatures</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginTop: "14px", breakInside: "avoid" }}>
          <div>
            <div style={{ borderBottom: "1.5px solid var(--ink-text)", height: "46px", marginBottom: "8px" }}></div>
            <b style={{ display: "block", fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "13px", letterSpacing: ".03em", color: "var(--ink-text)" }}>JM Equipment Inc. — Authorized Rep</b>
            <span style={{ fontSize: "11px", color: "var(--subtle)" }}>{doc.rep} · Signature / Date</span>
          </div>
          <div>
            {doc.accepted && (
              <>
                <div style={{ borderBottom: "1.5px solid var(--jme-green)", height: "46px", marginBottom: "8px", display: "flex", alignItems: "flex-end", paddingBottom: "4px" }}><span style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive", fontSize: "26px", color: "var(--ink-text)", lineHeight: 1 }}>{doc.signed.name}</span></div>
                <b style={{ display: "block", fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "13px", letterSpacing: ".03em", color: "var(--ink-text)" }}>Buyer — Accepted</b>
                <span style={{ fontSize: "11px", color: "var(--jme-green)", fontWeight: 600 }}>{doc.signed.date}</span>
              </>
            )}
            {!doc.accepted && (
              <>
                <div style={{ borderBottom: "1.5px solid var(--ink-text)", height: "46px", marginBottom: "8px" }}></div>
                <b style={{ display: "block", fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "13px", letterSpacing: ".03em", color: "var(--ink-text)" }}>Buyer — Authorized Representative</b>
                <span style={{ fontSize: "11px", color: "var(--subtle)" }}>{doc.client.company} · Signature / Date</span>
              </>
            )}
          </div>
        </div>
        <div style={{ background: "var(--jme-charcoal)", color: "#fff", borderRadius: "var(--r-1)", marginTop: "28px", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", breakInside: "avoid" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/jme-diamond-cut.png" alt="JME" style={{ width: "30px", display: "block" }} />
            <div>
              <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "16px", letterSpacing: ".05em" }}>JM Equipment Inc.</div>
              <div style={{ fontSize: "9px", color: "var(--paper-dim)", marginTop: "2px" }}>{doc.company.addr} · {doc.company.phone}</div>
            </div>
          </div>
          <span className="jme-mono" style={{ fontSize: "11px", color: "var(--paper-dim)" }}>Est. 1989</span>
        </div>
      </div>
    </div>
  );
}
