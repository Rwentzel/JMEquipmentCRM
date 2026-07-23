import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OpsLogin } from "@/components/ops/OpsLogin";
import { PrintBar } from "@/components/ops/PrintBar";
import { OPS_COOKIE, opsMode, verifySession } from "@/lib/opsAuth";
import { getRfq } from "@/lib/rfqStore";
import { catalog } from "@/data/catalog";
import { asset } from "@/lib/utils";
import "@/styles/quote-doc.css";

/**
 * Printable written quotation — internal, ops-authed. This is the ONLY page
 * that renders quote pricing, and it sits behind the same session gate as
 * the ops desk. Layout follows the JME Quote Doc design (Claude Design
 * handoff); terms text is JM Equipment's standard quotation terms.
 */

export const dynamic = "force-dynamic";

const TERMS: Array<{ t: string; d: string }> = [
  { t: "Quotation Validity", d: "This quotation is valid for the stated number of calendar days from the date of issue. Prices are in USD." },
  { t: "Equipment Condition", d: "Equipment is sold as specified. Refurbished units per JME condition report; new units per OEM specification." },
  { t: "FOB Terms", d: "All shipments are FOB Sturgis, MI unless otherwise agreed in writing." },
  { t: "Warranty Coverage", d: "New JME-manufactured equipment: 1 year. Goodstrong new equipment: 12 months. Martin refurbished: 6 months." },
  { t: "Warranty Exclusions", d: "Warranty does not cover normal wear, consumables, misuse, unauthorized repair, or modification." },
  { t: "Freight & Tariffs", d: "Freight and import duties are buyer responsibility unless stated. Tariff rates reflect the rate at time of quote and are subject to change." },
  { t: "Governing Law", d: "This agreement is governed by the laws of the State of Michigan, United States." },
  { t: "Acceptance", d: "Equipment ordered or PO issued constitutes acceptance of these terms and conditions." },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function validUntil(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function QuoteDocPage({ params }: { params: { ref: string } }) {
  const mode = opsMode();
  if (mode === "disabled") {
    return (
      <main className="ops-gate">
        <h1>Ops desk is disabled</h1>
        <p>Set the <code>OPS_TOKEN</code> environment variable to enable the internal console.</p>
      </main>
    );
  }
  const authed = mode === "dev-open" || verifySession(cookies().get(OPS_COOKIE)?.value);
  if (!authed) return <OpsLogin />;

  const rfq = await getRfq(params.ref);
  if (!rfq || !rfq.quote) notFound();
  const q = rfq.quote;
  const c = catalog.contact;

  return (
    <div className="qd-wrap">
      <PrintBar backHref="/ops" />
      <article className="qd" id="jme-quote-doc">
        <header className="qd__hd">
          <div className="qd__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("jme-diamond-cut.png")} alt="JME" />
            <div>
              <b>{c.company}</b>
              <span>{c.tagline}</span>
            </div>
          </div>
          <div className="qd__meta">
            <span className="qd__kicker">Parts Quotation</span>
            <b className="qd__num">{q.number}</b>
            <span>Issued {fmtDate(q.updatedAt)}</span>
            <span>Valid until {validUntil(q.updatedAt, q.validDays)}</span>
            <span>FOB Sturgis, MI</span>
          </div>
        </header>

        <div className="qd__rule" />

        <section className="qd__parties">
          <div>
            <h3>Prepared for</h3>
            <b>{rfq.contact.company}</b>
            <span>
              {rfq.contact.name}
              {rfq.contact.lastName ? ` ${rfq.contact.lastName}` : ""}
            </span>
            <span>{rfq.contact.email}</span>
            {rfq.contact.phone && (
              <span>
                {rfq.contact.phone}
                {rfq.contact.phoneExt ? ` ext. ${rfq.contact.phoneExt}` : ""}
              </span>
            )}
            {rfq.contact.shipAddress && <span>Ship to: {rfq.contact.shipAddress}</span>}
          </div>
          <div>
            <h3>From</h3>
            <b>{c.company}</b>
            <span>{c.address}</span>
            <span>{c.phone}</span>
            <span>{c.email}</span>
            <span className="qd__ref">Request ref: {rfq.ref}</span>
          </div>
        </section>

        <section className="qd__badges">
          <div><b>Est. 1989</b><span>Serving industry</span></div>
          <div><b>Same-day</b><span>On stocked items, PO by 2:30 PM ET</span></div>
          <div><b>FOB</b><span>Sturgis, MI</span></div>
          <div><b>Written quote</b><span>Valid {q.validDays} days</span></div>
        </section>

        <section className="qd__items">
          <div className="qd__row qd__row--head">
            <div>Item</div>
            <div className="r">Amount</div>
          </div>
          {q.lines.map((l, i) => (
            <div className="qd__row" key={i}>
              <div>{l.label}</div>
              <div className="r mono">{l.amount || "—"}</div>
            </div>
          ))}
          {q.freight && (
            <div className="qd__row">
              <div>Freight (estimated)</div>
              <div className="r mono">{q.freight}</div>
            </div>
          )}
          <div className="qd__row qd__row--total">
            <div>Total quote amount</div>
            <div className="r mono">{q.total || "See lines"}</div>
          </div>
        </section>

        {q.notes && (
          <section className="qd__notes">
            <h3>Notes</h3>
            <p>{q.notes}</p>
          </section>
        )}

        <section className="qd__terms">
          <h3>Terms &amp; Conditions</h3>
          <ol>
            {TERMS.map((t) => (
              <li key={t.t}>
                <b>{t.t}.</b> {t.d}
              </li>
            ))}
          </ol>
        </section>

        <footer className="qd__ft">
          <span>
            {c.company} · {c.address} · {c.phone} · {c.email}
          </span>
        </footer>
      </article>
    </div>
  );
}
