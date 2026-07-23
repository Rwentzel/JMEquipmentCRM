"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Diamond } from "@/components/ui";
import {
  expiryInfo,
  priceBreak,
  stageProb,
  usd,
  LOSS_REASONS,
  type QcClient,
  type QcMachine,
  type QcSettings,
  type Quote,
  type QuoteStatus,
} from "@/lib/qc/pricing";

/**
 * Quote Center console — dashboard, pipeline, quote builder, client book.
 * Ported from the JME Quote Center design. All data flows through the
 * ops-authed /api/ops/qc API at runtime; no pricing is bundled here.
 * "Present mode" hides internal cost & margin for screen-sharing.
 */

type View = "dash" | "pipeline" | "builder" | "clients";

const STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "won", "lost"];

const usdShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (a >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("en-US") + "K";
  return "$" + Math.round(n).toLocaleString("en-US");
};

export function QuoteCenterClient() {
  const [view, setView] = useState<View>("dash");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<QcClient[]>([]);
  const [catalog, setCatalog] = useState<QcMachine[]>([]);
  const [settings, setSettings] = useState<QcSettings | null>(null);
  const [bq, setBq] = useState<Quote | null>(null);
  const [present, setPresent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lossFor, setLossFor] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState(LOSS_REASONS[0]!);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/qc");
    if (!res.ok) return;
    const d = await res.json();
    setQuotes(d.quotes ?? []);
    setClients(d.clients ?? []);
    setCatalog(d.catalog ?? []);
    setSettings(d.settings ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state set after await
    void load();
  }, [load]);

  async function api(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch("/api/ops/qc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      say("Request failed");
      return null;
    }
    return res.json();
  }

  const machine = (id: string | null) => catalog.find((m) => m.id === id) ?? null;

  function blankQuote(machineId: string | null): Quote {
    const m = machine(machineId);
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: "", shareToken: "", number: "(assigned on save)", status: "draft", machineId,
      clientCompany: "", clientContact: "", clientDept: "", clientCity: "", clientEmail: "", po: "",
      base: m?.base ?? 0, crating: m?.crating ?? 0, addons: [], parts: [],
      discMode: "amt", discAmt: 0, discPct: 0, freight: 0,
      tariffPct: m?.isImport ? settings?.tariff ?? 0 : 0, taxPct: 0,
      cost: Math.round((m?.base ?? 0) * 0.72),
      payment: m?.payment ?? "50-50", lead: m?.lead ?? "", warranty: m?.warranty ?? "",
      validity: settings?.validity ?? 60, rep: settings?.rep ?? "", notes: "", lostReason: "",
      signedName: "", signedDate: "", createdAt: today,
      followUpDate: "", followUpNote: "", followUpDone: false,
      activity: [],
    };
  }

  const set = <K extends keyof Quote>(k: K, v: Quote[K]) => setBq((q) => (q ? { ...q, [k]: v } : q));

  function pickMachine(id: string) {
    const m = machine(id || null);
    setBq((q) => q && {
      ...q, machineId: id || null,
      base: m?.base ?? 0, crating: m?.crating ?? 0,
      payment: m?.payment ?? q.payment, lead: m?.lead ?? "", warranty: m?.warranty ?? "",
      tariffPct: m?.isImport ? settings?.tariff ?? 0 : 0,
      cost: Math.round((m?.base ?? 0) * 0.72),
      addons: [],
    });
  }

  async function saveQuote(status?: QuoteStatus): Promise<Quote | null> {
    if (!bq) return null;
    if (!bq.clientCompany.trim()) {
      say("Add a client company first");
      return null;
    }
    const payload: Record<string, unknown> = { ...bq };
    if (!bq.id) delete payload.id;
    if (status) payload.status = status;
    const d = await api({ kind: "saveQuote", quote: payload });
    if (!d?.quote) return null;
    const saved = d.quote as Quote;
    setBq(saved);
    await load();
    say(status === "sent" ? "Quote saved — share link ready" : "Quote saved");
    return saved;
  }

  async function setStatus(id: string, status: QuoteStatus, reason?: string) {
    await api({ kind: "status", id, status, lostReason: reason });
    await load();
    say("Status → " + status);
  }

  async function fromRfqPrompt() {
    const ref = window.prompt("RFQ ref from the ops inbox (e.g. RFQ-1A2B3C4D):");
    if (!ref) return;
    const d = await api({ kind: "fromRfq", rfqRef: ref.trim() });
    if (d?.quote) {
      setBq(d.quote as Quote);
      setView("builder");
      await load();
      say("Draft created from " + ref.trim());
    }
  }

  function shareUrl(q: Quote): string {
    return `${window.location.origin}/quote/${q.id}/${q.shareToken}`;
  }

  async function copyLink(q: Quote) {
    try {
      await navigator.clipboard.writeText(shareUrl(q));
      say("Customer link copied");
    } catch {
      say(shareUrl(q));
    }
  }

  function emailQuote(q: Quote) {
    const m = machine(q.machineId);
    const total = priceBreak(q).total;
    const subj = `JM Equipment Quotation ${q.number} — ${m ? m.name : "Parts"}`;
    const body = `Hello ${q.clientContact || q.clientCompany},\n\nThank you for the opportunity to quote. Please find your quotation below.\n\nQuote: ${q.number}\nEquipment: ${m ? `${m.name} (${m.sku})` : "Replacement parts"}\nTotal: ${total > 0 ? usd(total) : "by consultation"}\nValid: ${q.validity} days, FOB ${settings?.fob ?? "Sturgis, MI"}\n\nView, download, and accept online:\n${shareUrl(q)}\n\nRegards,\n${q.rep || settings?.rep || ""}\n${settings?.company ?? "JM Equipment Inc."} · ${settings?.phone ?? ""}\n${settings?.email ?? ""}`;
    window.location.href = `mailto:${encodeURIComponent(q.clientEmail)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  }

  /* ---- derived ---- */
  const open = quotes.filter((q) => q.status === "draft" || q.status === "sent");
  const wonish = quotes.filter((q) => q.status === "won" || q.status === "accepted");
  const lost = quotes.filter((q) => q.status === "lost");
  const winRate = wonish.length + lost.length > 0 ? Math.round((wonish.length / (wonish.length + lost.length)) * 100) : 0;
  const weighted = quotes.filter((q) => q.status !== "won" && q.status !== "lost").reduce((t, q) => t + Math.round(priceBreak(q).total * stageProb(q.status)), 0);
  const followUps = quotes.filter((q) => q.followUpDate && !q.followUpDone).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
  const pb = bq ? priceBreak(bq) : null;
  const marginColor = pb && (pb.marginPct >= 25 ? "var(--jme-green)" : pb.marginPct >= 15 ? "var(--jme-gold)" : "var(--jme-red-bright)");

  const rows = useMemo(() => [...quotes].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), [quotes]);

  return (
    <main className="ops qc">
      <header className="ops__hd">
        <Diamond size={14} />
        <b>JM Equipment · Quote Center</b>
        <nav className="qc__nav">
          {(["dash", "pipeline", "builder", "clients"] as View[]).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => { if (v === "builder" && !bq) setBq(blankQuote(catalog[0]?.id ?? null)); setView(v); }}>
              {v === "dash" ? "Dashboard" : v === "pipeline" ? "Pipeline" : v === "builder" ? "Quote Builder" : "Clients"}
            </button>
          ))}
        </nav>
        <label className="qc__present" title="Hide internal cost & margin">
          <input type="checkbox" checked={present} onChange={(e) => setPresent(e.target.checked)} /> Present mode
        </label>
        <a className="ops__logout" href="/ops">← Ops desk</a>
      </header>

      {view === "dash" && (
        <>
          <section className="ops__counts">
            {[
              { v: String(open.length), l: "Open quotes" },
              { v: usdShort(open.reduce((t, q) => t + priceBreak(q).total, 0)), l: "Pipeline value" },
              { v: usdShort(weighted), l: "Weighted forecast" },
              { v: winRate + "%", l: `${wonish.length} won · ${lost.length} lost` },
              { v: String(clients.length), l: "Clients" },
            ].map((s) => (
              <div key={s.l} className="ops__count on"><b>{s.v}</b><span>{s.l}</span></div>
            ))}
          </section>
          <section className="ops__inbox">
            <div className="ops__sechd"><h2>Follow-ups</h2>
              <div className="ops__agentbtns">
                <button onClick={() => { setBq(blankQuote(catalog[0]?.id ?? null)); setView("builder"); }}>+ New quote</button>
                <button onClick={() => void fromRfqPrompt()}>From RFQ…</button>
              </div>
            </div>
            {followUps.length === 0 && <p className="ops__empty">No pending follow-ups.</p>}
            {followUps.map((q) => (
              <p key={q.id} className="qc__fu">
                <b className="mono">{q.number}</b> {q.followUpNote || "Follow up"} — due {q.followUpDate}{" "}
                <button className="qc__linkbtn" onClick={() => { setBq(q); setView("builder"); }}>open</button>
              </p>
            ))}
          </section>
        </>
      )}

      {(view === "dash" || view === "pipeline") && (
        <section className="ops__inbox">
          <div className="ops__sechd"><h2>{view === "dash" ? "Recent quotes" : "Quote pipeline"}</h2><button onClick={() => void load()}>Refresh</button></div>
          {rows.length === 0 && <p className="ops__empty">No quotes yet — build the first one.</p>}
          {rows.length > 0 && (
            <div className="ops__tablewrap">
              <table className="ops__table">
                <thead><tr><th>Quote #</th><th>Client</th><th>Equipment</th><th>Total</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {(view === "dash" ? rows.slice(0, 7) : rows).map((q) => {
                    const m = machine(q.machineId);
                    const total = priceBreak(q).total;
                    const exp = expiryInfo(q);
                    return (
                      <tr key={q.id}>
                        <td className="mono">{q.number}</td>
                        <td><b>{q.clientCompany}</b><small>{q.clientContact}</small></td>
                        <td>{m ? m.name : "Parts quote"}<small className="mono">{m ? m.sku : "JME-PARTS"}</small></td>
                        <td className="mono">{total > 0 ? usd(total) : "Consult"}</td>
                        <td>{exp.active ? <span className={exp.expired ? "qc__exp bad" : exp.daysLeft !== null && exp.daysLeft <= 14 ? "qc__exp warn" : ""}>{exp.active ? exp.label : ""}</span> : "—"}</td>
                        <td>
                          <select value={q.status} aria-label={`Status for ${q.number}`} onChange={(e) => {
                            const v = e.target.value as QuoteStatus;
                            if (v === "lost") { setLossFor(q.id); setLossReason(LOSS_REASONS[0]!); } else void setStatus(q.id, v);
                          }}>
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="qc__acts">
                          <button onClick={() => { setBq(q); setView("builder"); }}>Edit</button>
                          <button onClick={() => void copyLink(q)}>Link</button>
                          <button onClick={() => emailQuote(q)}>Email</button>
                          <a href={`/quote/${q.id}/${q.shareToken}`} target="_blank" rel="noreferrer">View</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === "builder" && bq && pb && (
        <section className="qc__builder">
          <div className="qc__form">
            <div className="ops__sechd"><h2>{bq.id ? `Edit ${bq.number}` : "New quote"}</h2>
              <div className="ops__agentbtns">
                <button onClick={() => void saveQuote()}>Save draft</button>
                <button onClick={() => { void saveQuote("sent").then((q) => q && emailQuote(q)); }}>Save &amp; send</button>
                {bq.id && <a className="qc__doclink" href={`/quote/${bq.id}/${bq.shareToken}`} target="_blank" rel="noreferrer">Open document ↗</a>}
              </div>
            </div>

            <h3>Client</h3>
            <div className="qc__grid">
              <select aria-label="Load client" defaultValue="" onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); if (c) setBq((q) => q && { ...q, clientCompany: c.company, clientContact: c.contact, clientCity: c.city, clientEmail: c.email }); }}>
                <option value="">Load from client book…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
              <input placeholder="Company *" value={bq.clientCompany} onChange={(e) => set("clientCompany", e.target.value)} />
              <input placeholder="Contact" value={bq.clientContact} onChange={(e) => set("clientContact", e.target.value)} />
              <input placeholder="City, ST" value={bq.clientCity} onChange={(e) => set("clientCity", e.target.value)} />
              <input placeholder="Email" value={bq.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
              <input placeholder="PO #" value={bq.po} onChange={(e) => set("po", e.target.value)} />
            </div>

            <h3>Equipment</h3>
            <div className="qc__grid">
              <select value={bq.machineId ?? ""} aria-label="Equipment" onChange={(e) => pickMachine(e.target.value)}>
                <option value="">Parts-only quote</option>
                {catalog.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.sub}</option>)}
              </select>
              <label>Base $<input type="number" value={bq.base} onChange={(e) => set("base", +e.target.value || 0)} /></label>
              <label>Crating $<input type="number" value={bq.crating} onChange={(e) => set("crating", +e.target.value || 0)} /></label>
              <label>Lead<input value={bq.lead} onChange={(e) => set("lead", e.target.value)} /></label>
              <label>Warranty<input value={bq.warranty} onChange={(e) => set("warranty", e.target.value)} /></label>
            </div>
            {machine(bq.machineId) && machine(bq.machineId)!.options.length > 0 && (
              <div className="qc__opts">
                {machine(bq.machineId)!.options.map((o) => {
                  const on = bq.addons.some((a) => a.label === o.label);
                  return (
                    <button key={o.key} className={on ? "on" : ""} onClick={() => set("addons", on ? bq.addons.filter((a) => a.label !== o.label) : [...bq.addons, { label: o.label, amount: o.amount }])}>
                      {o.label} · {usd(o.amount)}
                    </button>
                  );
                })}
              </div>
            )}

            <h3>Parts lines</h3>
            {bq.parts.map((p, i) => (
              <div key={i} className="qc__grid qc__partline">
                <input value={p.sku} placeholder="SKU" onChange={(e) => set("parts", bq.parts.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} />
                <input value={p.name} placeholder="Description" onChange={(e) => set("parts", bq.parts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <label>Qty<input type="number" min={1} value={p.qty} onChange={(e) => set("parts", bq.parts.map((x, j) => (j === i ? { ...x, qty: Math.max(1, +e.target.value || 1) } : x)))} /></label>
                <label>Price $<input type="number" value={p.price} onChange={(e) => { const v = +e.target.value || 0; set("parts", bq.parts.map((x, j) => (j === i ? { ...x, price: v, rfq: v <= 0 } : x))); }} /></label>
                <button onClick={() => set("parts", bq.parts.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="qc__linkbtn" onClick={() => set("parts", [...bq.parts, { sku: "", name: "", qty: 1, price: 0, rfq: true }])}>+ Add part line</button>

            <h3>Commercial</h3>
            <div className="qc__grid">
              <label>Discount $<input type="number" value={bq.discAmt} onChange={(e) => { set("discAmt", +e.target.value || 0); set("discMode", "amt"); }} /></label>
              <label>Tariff %<input type="number" value={bq.tariffPct} onChange={(e) => set("tariffPct", +e.target.value || 0)} /></label>
              <label>Freight $<input type="number" value={bq.freight} onChange={(e) => set("freight", +e.target.value || 0)} /></label>
              <label>Tax %<input type="number" value={bq.taxPct} onChange={(e) => set("taxPct", +e.target.value || 0)} /></label>
              <select value={bq.payment} aria-label="Payment plan" onChange={(e) => set("payment", e.target.value as Quote["payment"])}>
                <option value="50-50">50 / 50</option>
                <option value="30-60-10">30 / 60 / 10</option>
                <option value="net30">Net 30</option>
              </select>
              <label>Validity (days)<input type="number" value={bq.validity} onChange={(e) => set("validity", +e.target.value || 60)} /></label>
              {!present && <label>Internal cost $<input type="number" value={bq.cost} onChange={(e) => set("cost", +e.target.value || 0)} /></label>}
              <label>Follow-up<input type="date" value={bq.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} /></label>
            </div>
            <textarea placeholder="Internal notes" value={bq.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <aside className="qc__totals">
            <h3>Totals</h3>
            <p><span>Subtotal</span><b className="mono">{usd(pb.subtotal)}</b></p>
            {pb.discount > 0 && <p><span>Discount</span><b className="mono">−{usd(pb.discount)}</b></p>}
            {pb.tariff > 0 && <p><span>Tariff {pb.tariffPct}%</span><b className="mono">{usd(pb.tariff)}</b></p>}
            {pb.freight > 0 && <p><span>Freight</span><b className="mono">{usd(pb.freight)}</b></p>}
            {pb.tax > 0 && <p><span>Tax {pb.taxPct}%</span><b className="mono">{usd(pb.tax)}</b></p>}
            <p className="qc__grand"><span>Total</span><b className="mono">{pb.total > 0 ? usd(pb.total) : "Consult"}</b></p>
            {!present && (
              <p className="qc__margin" style={{ color: marginColor ?? undefined }}>
                <span>Margin</span><b className="mono">{pb.afterDisc > 0 ? `${pb.marginPct}% · ${usd(pb.marginAmt)}` : "—"}</b>
              </p>
            )}
            {!present && pb.afterDisc > 0 && pb.marginPct < 15 && <p className="qc__warn">Margin below 15% floor</p>}
            <p className="qc__prob"><span>Stage weight</span><b>{Math.round(stageProb(bq.status) * 100)}% → {usd(Math.round(pb.total * stageProb(bq.status)))}</b></p>
          </aside>
        </section>
      )}

      {view === "clients" && (
        <section className="ops__inbox">
          <div className="ops__sechd"><h2>Client book</h2>
            <button onClick={() => { void api({ kind: "saveClient", client: { company: "New Client" } }).then(load); }}>+ Add client</button>
          </div>
          {clients.length === 0 && <p className="ops__empty">No clients yet — they save automatically from quotes, or add one.</p>}
          {clients.length > 0 && (
            <div className="ops__tablewrap">
              <table className="ops__table">
                <thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>City</th><th>Industry</th><th></th></tr></thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      {(["company", "contact", "email", "city", "industry"] as const).map((k) => (
                        <td key={k}>
                          <input className="qc__cell" value={c[k]} aria-label={`${k} for ${c.company}`} onChange={(e) => setClients((cs) => cs.map((x) => (x.id === c.id ? { ...x, [k]: e.target.value } : x)))} onBlur={() => void api({ kind: "saveClient", client: clients.find((x) => x.id === c.id) as unknown as Record<string, unknown> })} />
                        </td>
                      ))}
                      <td className="qc__acts">
                        <button onClick={() => { const q = blankQuote(catalog[0]?.id ?? null); setBq({ ...q, clientCompany: c.company, clientContact: c.contact, clientCity: c.city, clientEmail: c.email }); setView("builder"); }}>Quote</button>
                        <button onClick={() => { void api({ kind: "deleteClient", id: c.id }).then(load); }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {lossFor && (
        <div className="qc__modal" role="dialog" aria-label="Loss reason">
          <div className="qc__modalbox">
            <h3>Why was it lost?</h3>
            <select value={lossReason} aria-label="Loss reason" onChange={(e) => setLossReason(e.target.value)}>
              {LOSS_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <div className="ops__agentbtns">
              <button onClick={() => { void setStatus(lossFor, "lost", lossReason); setLossFor(null); }}>Mark lost</button>
              <button onClick={() => setLossFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="qc__toast" role="status">{toast}</div>}
    </main>
  );
}
