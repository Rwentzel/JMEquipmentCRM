import { Diamond } from "@/components/ui";
import {
  expiryInfo,
  paymentSchedule,
  priceBreak,
  resolvedTerms,
  usd2,
  type QcMachine,
  type QcSettings,
  type Quote,
} from "@/lib/qc/pricing";

/**
 * The printed JME quotation document — ported from the "JME Quote Doc" design.
 * Server-renderable; used by the customer share page and the ops print view.
 * Shows sell pricing (this IS the written quote) but never cost or margin.
 */
export function QuoteDoc({ quote: q, machine: m, settings: s }: { quote: Quote; machine: QcMachine | null; settings: QcSettings }) {
  const pb = priceBreak(q);
  const consultation = pb.total <= 0;
  const rows: Array<{ label: string; amount: string }> = [];
  if (q.base > 0) rows.push({ label: m ? "Base Equipment Price" : "Parts & Components Subtotal", amount: usd2(q.base) });
  if (q.crating > 0) rows.push({ label: "Crating & Export Packaging", amount: usd2(q.crating) });
  for (const a of q.addons) if (a.label || a.amount) rows.push({ label: a.label || "Option", amount: usd2(a.amount) });
  for (const p of q.parts) rows.push({ label: `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""} (${p.sku})`, amount: p.rfq ? "RFQ" : usd2(p.qty * p.price) });
  if (rows.length === 0) rows.push({ label: "Configuration & pricing by consultation", amount: "—" });

  const totals: Array<{ label: string; amount: string; red?: boolean }> = [];
  if (!consultation) {
    totals.push({ label: "Subtotal", amount: usd2(pb.subtotal) });
    if (pb.discount > 0) totals.push({ label: `Discount${q.discMode === "pct" ? ` (${q.discPct}%)` : ""}`, amount: "−" + usd2(pb.discount), red: true });
    if (pb.tariff > 0) totals.push({ label: `Import tariff (${pb.tariffPct}%)`, amount: usd2(pb.tariff) });
    if (pb.freight > 0) totals.push({ label: "Freight (estimated)", amount: usd2(pb.freight) });
    if (pb.tax > 0) totals.push({ label: `Sales tax (${pb.taxPct}%)`, amount: usd2(pb.tax) });
  }
  const payment = paymentSchedule(q.payment, pb.total);
  const clientLine = [[q.clientContact, q.clientDept].filter(Boolean).join(" · "), q.clientCity, q.po ? `PO: ${q.po}` : ""].filter(Boolean).join("   ");
  const accepted = q.status === "accepted" || q.status === "won";
  const specs = m ? m.specs : [
    { k: "Order Type", v: "Replacement Parts" },
    { k: "Supplier", v: s.company },
    { k: "Origin", v: s.fob },
    { k: "Support", v: "24/7 parts desk" },
  ];

  return (
    <div className="qdoc" id="jme-print-doc">
      <header className="qdoc__hd">
        <div className="qdoc__brand">
          <Diamond size={34} />
          <div>
            <b>{s.company}</b>
            <small>Converting Machinery Solutions</small>
          </div>
        </div>
        <div className="qdoc__meta">
          <span className="qdoc__kicker">{m ? "Quotation" : "Parts Quotation"}</span>
          <b className="mono">{q.number}</b>
          <small>Valid {q.validity} days · until {expiryInfo(q).untilStr} · FOB {s.fob}</small>
        </div>
      </header>

      <section className="qdoc__machine">
        <div>
          <h1>{m ? m.name : "Replacement Parts & Components"}</h1>
          <p className="qdoc__sub">{m ? m.sub : `${q.parts.length} line item${q.parts.length === 1 ? "" : "s"}`} · <span className="mono">{m ? m.sku : "JME-PARTS"}</span></p>
          <p className="qdoc__desc">{m ? m.desc : "Genuine and refurbished replacement parts supplied and supported by JM Equipment Inc. from Sturgis, Michigan — same-day shipping on stocked items."}</p>
        </div>
        <div className="qdoc__badges">
          {[
            { b: "EST. 1989", s: "Serving Industry" },
            { b: q.warranty || (m ? m.warranty : "Genuine"), s: "Warranty" },
            { b: q.lead || (m ? m.lead : "Same-Day"), s: "Lead Time" },
            { b: "FOB", s: s.fob },
          ].map((x) => (
            <div key={x.s} className="qdoc__badge"><b>{x.b}</b><span>{x.s}</span></div>
          ))}
        </div>
      </section>

      <section className="qdoc__cols">
        <div>
          <h3>Prepared For</h3>
          <p><b>{q.clientCompany || "—"}</b><br />{clientLine || "—"}</p>
          <h3>Specifications</h3>
          <table className="qdoc__spec"><tbody>
            {specs.map((row) => (
              <tr key={row.k}><td>{row.k}</td><td>{row.v}</td></tr>
            ))}
          </tbody></table>
          {m && m.pkg.length > 0 && (
            <>
              <h3>Included Package</h3>
              <ul className="qdoc__pkg">{m.pkg.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          )}
        </div>
        <div>
          <h3>Pricing</h3>
          <table className="qdoc__price"><tbody>
            {rows.map((r, i) => (
              <tr key={i}><td>{r.label}</td><td className="r mono">{r.amount}</td></tr>
            ))}
            {totals.map((r, i) => (
              <tr key={"t" + i} className="tot"><td>{r.label}</td><td className={"r mono" + (r.red ? " red" : "")}>{r.amount}</td></tr>
            ))}
            <tr className="grand"><td>Total Quote Amount</td><td className="r mono">{consultation ? "By Consultation" : usd2(pb.total)}</td></tr>
          </tbody></table>
          <h3>Payment Schedule</h3>
          <table className="qdoc__price"><tbody>
            {payment.map((r) => (
              <tr key={r.label}><td>{r.label}</td><td className="r mono">{r.amount}</td></tr>
            ))}
          </tbody></table>
        </div>
      </section>

      <section className="qdoc__terms">
        <h3>Terms &amp; Conditions</h3>
        <div className="qdoc__termgrid">
          {resolvedTerms(q.validity, s.fob).map((t) => (
            <div key={t.t}><b>{t.t}.</b> {t.d}</div>
          ))}
        </div>
      </section>

      <footer className="qdoc__foot">
        <div>
          <b>{s.company}</b> · {s.addr} · {s.phone} · {s.email}
          {q.rep && <span> · Rep: {q.rep}</span>}
        </div>
        <div className="qdoc__sig">
          {accepted ? (
            <span className="qdoc__accepted">Accepted by {q.signedName} · {q.signedDate}</span>
          ) : (
            <span className="qdoc__pending">Signature ______________________ Date ____________</span>
          )}
        </div>
      </footer>
    </div>
  );
}
