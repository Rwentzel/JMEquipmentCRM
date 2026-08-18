/**
 * JME Quote Center — pure business logic, ported 1:1 from the design
 * handoff's Component class (JME Quote Center.dc.html). No I/O, no DOM —
 * usable from client components, API routes, and tests alike.
 *
 * Money math is integer-dollar rounding exactly as the prototype does it.
 */

import { DISCLOSURES, TERM_TPL } from "./labels";
import type {
  QcActivity,
  QcCfg,
  QcMachine,
  QcPriceBreak,
  QcQuote,
  QcSettings,
  QcSpec,
  QcStatus,
  QuoteDocModel,
} from "./types";

/* ---------------------------------------------------------------- token --- */

/** Random capability token for public quote links. Uses Web Crypto (browser and Node 18+). */
export function genToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------------------------------------- money --- */

/**
 * Splits a total into instalments that actually add up to it.
 *
 * Rounding each share independently does not: on a $24,999.04 quote the
 * 30/60/10 schedule printed $7,499.71 + $14,999.42 + $2,499.90 = $24,999.03,
 * a cent short of the total printed directly above it. Half of all cent values
 * broke the 50/50 split the same way. That is a signed document a customer
 * pays against, so the instalments carry the remainder: every share but the
 * last is rounded to cents, and the last is whatever is left.
 */
export function splitPayment(total: number, shares: number[]): number[] {
  const cents = Math.round((+total || 0) * 100);
  const out: number[] = [];
  let assigned = 0;
  for (let i = 0; i < shares.length - 1; i++) {
    const c = Math.round(cents * shares[i]);
    out.push(c / 100);
    assigned += c;
  }
  out.push((cents - assigned) / 100);
  return out;
}

export function usd(n: number): string {
  return "$" + Math.round(+n || 0).toLocaleString("en-US");
}

export function usd2(n: number): string {
  return "$" + Number(+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Money for the internal builder: cents only when there are cents.
 *
 * The builder rounded every figure to whole dollars while the client document
 * printed cents, so the desk read one number off the screen and the customer
 * read another off the quote. A part priced $224.85 showed as "$225 ea" while
 * the line on the customer's copy came to $899.40 for four — a difference the
 * desk could not reconcile against its own screen. Fifteen catalogue parts
 * carry cents today, and any typed amount can now.
 *
 * Whole dollars still print without a trailing ".00", so nothing in the
 * builder gets noisier than it was.
 */
export function usdAuto(n: number): string {
  const v = +n || 0;
  return Math.round(v * 100) % 100 === 0 ? usd(v) : usd2(v);
}

export function usdShort(n: number): string {
  n = Math.round(+n || 0);
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (a >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("en-US") + "K";
  return "$" + n.toLocaleString("en-US");
}

/* ------------------------------------------------------------ dates/ids --- */

export function nowISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(s: string): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(+d)) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Quote numbers auto-generate `Q-YY-MMDD-<seq>` (seq = count + 1, 2-digit). */
export function genNumber(existingCount: number, d = new Date()): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seq = String(existingCount + 1).padStart(2, "0");
  return `Q-${yy}-${mm}${dd}-${seq}`;
}

/* ------------------------------------------------------------ configurator --- */

export function cfgOf(q: QcQuote | null, machine: QcMachine | null): QcCfg | null {
  void q;
  return (machine && machine.cfg) || null;
}

export function cfgOptionLines(q: QcQuote | null, machine: QcMachine | null) {
  const cfg = (machine && machine.cfg) || null;
  if (!cfg || !cfg.options) return [];
  const on = (q && q.cfgOpts) || [];
  return cfg.options.filter((o) => on.indexOf(o.key) >= 0).map((o) => ({ key: o.key, label: o.label, amount: +o.amount || 0 }));
}

export function applyPricedAxes(q: QcQuote, m: QcMachine | null): void {
  const cfg = (m && m.cfg) || null;
  if (!cfg || !cfg.axes) return;
  cfg.axes.forEach((ax) => {
    if (!ax.priced) return;
    const val = (q.config || {})[ax.key];
    const o = (ax.options || []).find((x) => x.v === val);
    if (!o) return;
    if (o.consult) {
      q.base = 0;
      q.crating = 0;
    } else {
      if (o.base != null) q.base = o.base;
      if (o.crating != null) q.crating = o.crating;
    }
    if (o.lead != null) q.lead = o.lead;
    if (o.warranty != null) q.warranty = o.warranty;
  });
}

export function initConfig(q: QcQuote, m: QcMachine | null): QcQuote {
  q.config = {};
  q.cfgOpts = [];
  const cfg = (m && m.cfg) || null;
  if (cfg && cfg.axes) {
    cfg.axes.forEach((ax) => {
      q.config![ax.key] = ax.default;
    });
    applyPricedAxes(q, m);
  }
  return q;
}

/**
 * The configuration a quote effectively has: the machine's axis defaults
 * overlaid with anything explicitly chosen.
 *
 * Stored quotes routinely carry no `config` at all — the builder fills it in
 * memory via initConfig(), but nothing writes it back unless the rep opens
 * the configurator. Reading `q.config` directly therefore renders a customer
 * quote as `" Head · " Frame · JME-VCS-`, while the same quote looks correct
 * to staff. Every template/spec path resolves through here instead.
 */
export function effConfig(q: QcQuote, machine: QcMachine | null): Record<string, string> {
  const out: Record<string, string> = {};
  const axes = (machine && machine.cfg && machine.cfg.axes) || [];
  axes.forEach((ax) => {
    out[ax.key] = ax.default;
  });
  const conf = q.config || {};
  Object.keys(conf).forEach((k) => {
    if (conf[k] != null && conf[k] !== "") out[k] = conf[k]!;
  });
  return out;
}

export function fillTpl(tpl: string, q: QcQuote, machine: QcMachine | null): string {
  const cfg = (machine && machine.cfg) || ({} as QcCfg);
  const conf = effConfig(q, machine);
  return String(tpl).replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k.slice(-5) === "Label") {
      const axk = k.slice(0, -5);
      const ax = (cfg.axes || []).find((x) => x.key === axk);
      const o = ax && (ax.options || []).find((x) => x.v === conf[axk]);
      return o ? o.label : "";
    }
    let v = conf[k] != null ? conf[k] : "";
    if (k === "frame" && v === "custom") v = "CUSTOM";
    return v;
  });
}

export function resolvedSku(q: QcQuote, machine: QcMachine | null): string {
  // The SKU the customer actually ordered from. The cfg template would fill
  // from q.config, which describes the Quote Center's default build, not
  // theirs.
  if (q.rfqBuild) return q.rfqBuild.sku;
  if (machine && machine.cfg && machine.cfg.sku) return fillTpl(machine.cfg.sku, q, machine);
  return machine ? machine.sku : "JME-PARTS";
}

export function resolvedSubtitle(q: QcQuote, machine: QcMachine | null): string {
  if (q.rfqBuild) return q.rfqBuild.specs.map((s) => s.v).join(" · ");
  if (machine && machine.cfg && machine.cfg.subtitle) return fillTpl(machine.cfg.subtitle, q, machine);
  return machine ? machine.sub : "";
}

/**
 * The spec block for a machine quote.
 *
 * A storefront build overrides any catalogue spec that names the same thing —
 * otherwise the table lists "Power: 5 HP / 230V / 1PH" beside a request for
 * 460V — and displaces the cfg-derived rows, which come from q.config and so
 * describe the Quote Center's default build rather than the one requested.
 */
function machineSpecs(q: QcQuote, m: QcMachine): QcSpec[] {
  if (!q.rfqBuild) return (m.cfg ? cfgDerivedSpecs(q, m) : []).concat(m.specs);
  const named = new Set(q.rfqBuild.specs.map((s) => s.k.toLowerCase()));
  return q.rfqBuild.specs.concat(m.specs.filter((s) => !named.has(s.k.toLowerCase())));
}

export function cfgDerivedSpecs(q: QcQuote, machine: QcMachine | null): QcSpec[] {
  if (!machine || !machine.cfg || !machine.cfg.axes) return [];
  const out: QcSpec[] = [];
  const conf = effConfig(q, machine);
  machine.cfg.axes.forEach((ax) => {
    const val = conf[ax.key];
    const o = (ax.options || []).find((x) => x.v === val);
    if (!o) return;
    if (ax.specLabel) out.push({ k: ax.specLabel, v: o.label });
    if (o.cycle) out.push({ k: "Cycle Time", v: o.cycle });
  });
  return out;
}

export function cfgMinBase(m: QcMachine): number | null {
  if (!m || !m.cfg || !m.cfg.axes) return null;
  const ax = m.cfg.axes.find((a) => a.priced);
  if (!ax) return null;
  const b = (ax.options || []).filter((o) => o.base != null && !o.consult).map((o) => o.base!);
  return b.length ? Math.min(...b) : null;
}

/* --------------------------------------------------------------- pricing --- */

export function lineSubtotal(q: QcQuote | null, machine: QcMachine | null): number {
  if (!q) return 0;
  const base = +q.base || 0;
  const crating = +q.crating || 0;
  const add = (q.addons || []).reduce((t, a) => t + (+a.amount || 0), 0);
  const parts = (q.parts || []).reduce((t, p) => t + (p.rfq ? 0 : (+p.qty || 0) * (+p.price || 0)), 0);
  const cfg = cfgOptionLines(q, machine).reduce((t, o) => t + (+o.amount || 0), 0);
  return base + crating + add + parts + cfg;
}

export function discountAmt(q: QcQuote | null, machine: QcMachine | null, sub?: number): number {
  if (!q) return 0;
  sub = sub == null ? lineSubtotal(q, machine) : sub;
  if ((q.discMode || "amt") === "pct") return Math.round(sub * (+q.discPct! || 0) / 100);
  return Math.min(sub, Math.round(+q.discAmt! || 0));
}

export function priceBreak(q: QcQuote | null, machine: QcMachine | null): QcPriceBreak {
  if (!q)
    return { subtotal: 0, discount: 0, afterDisc: 0, tariff: 0, tariffPct: 0, freight: 0, tax: 0, taxPct: 0, total: 0, cost: 0, marginAmt: 0, marginPct: 0 };
  const subtotal = lineSubtotal(q, machine);
  const discount = discountAmt(q, machine, subtotal);
  const afterDisc = Math.max(0, subtotal - discount);
  const tariffPct = +q.tariffPct! || 0;
  const tariff = Math.round((+q.base || 0) * tariffPct / 100);
  const freight = Math.round(+q.freight! || 0);
  const taxPct = +q.taxPct! || 0;
  const tax = Math.round(afterDisc * taxPct / 100);
  const total = afterDisc + tariff + freight + tax;
  const cost = Math.round(+q.cost! || 0);
  const marginAmt = afterDisc - cost;
  const marginPct = afterDisc > 0 ? Math.round((marginAmt / afterDisc) * 100) : 0;
  return { subtotal, discount, afterDisc, tariff, tariffPct, freight, tax, taxPct, total, cost, marginAmt, marginPct };
}

export function cashTotal(q: QcQuote, machine: QcMachine | null): number {
  return priceBreak(q, machine).total;
}

/**
 * Quotes still waiting on a follow-up.
 *
 * Closing a quote does not clear its reminder, so a deal the rep marked lost —
 * with a reason — went on appearing in the desk's task list as overdue, for
 * ever. The list only ever grew. The note stays on the record either way; this
 * is about what is still owed, and nothing is owed on a closed deal.
 *
 * An accepted quote is deliberately still open: the PO and deposit are exactly
 * what a rep chases.
 */
export function pendingFollowUps(quotes: QcQuote[]): QcQuote[] {
  return quotes
    .filter((q) => q.followUpDate && !q.followUpDone && q.status !== "won" && q.status !== "lost")
    .sort((a, b) => (a.followUpDate || "").localeCompare(b.followUpDate || ""));
}

/** Stage probabilities for the weighted pipeline. */
export function stageProb(st: QcStatus): number {
  const M: Record<string, number> = { draft: 0.25, sent: 0.55, accepted: 0.9, won: 1, lost: 0 };
  return M[st] != null ? M[st] : 0;
}

export function weightedTotal(q: QcQuote, machine: QcMachine | null): number {
  return Math.round(cashTotal(q, machine) * stageProb(q.status));
}

/* ---------------------------------------------------------------- expiry --- */

export function expiryInfo(q: QcQuote | null) {
  if (!q || !q.createdAt) return { expired: false, daysLeft: null as number | null, untilStr: "", active: false, label: "" };
  const created = new Date(q.createdAt + "T00:00:00");
  if (isNaN(+created)) return { expired: false, daysLeft: null as number | null, untilStr: "", active: false, label: "" };
  const exp = new Date(created);
  exp.setDate(exp.getDate() + (+q.validity || 60));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((+exp - +today) / 86400000);
  const expired = daysLeft < 0;
  const active = q.status === "draft" || q.status === "sent";
  return {
    expired,
    daysLeft: daysLeft as number | null,
    untilStr: exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    active,
    label: expired ? "Expired" : daysLeft + (daysLeft === 1 ? " day left" : " days left"),
  };
}

/* -------------------------------------------------------------- activity --- */

export function deriveActivity(q: QcQuote): QcActivity[] {
  if (!q) return [];
  if (q.activity && q.activity.length) return q.activity.slice();
  const a: QcActivity[] = [{ type: "created", date: q.createdAt || nowISO() }];
  if (q.status && q.status !== "draft") a.push({ type: "sent", date: q.createdAt || nowISO() });
  if (q.signedDate) a.push({ type: "accepted", date: q.createdAt || nowISO(), by: q.signedName });
  return a;
}

export function actLabel(e: QcActivity): string {
  const by = e.by ? " by " + e.by : "";
  const M: Record<string, string> = {
    created: "Quote created",
    draft: "Returned to draft",
    sent: "Issued to client",
    viewed: "Viewed by client",
    accepted: "Accepted" + by,
    won: "Marked won",
    lost: "Marked lost",
  };
  return M[e.type] || e.type;
}

export function actDot(t: string): string {
  const M: Record<string, string> = {
    created: "var(--subtle)",
    draft: "var(--paper-faint)",
    sent: "var(--jme-blue)",
    viewed: "var(--jme-gold)",
    accepted: "var(--jme-green)",
    won: "var(--jme-green)",
    lost: "var(--jme-red)",
  };
  return M[t] || "var(--subtle)";
}

/* ------------------------------------------------------------- normalize --- */

export function normalizeQuote(q: QcQuote, machine: QcMachine | null, settings: QcSettings): QcQuote {
  if (!q) return q;
  if (q.discMode == null) q.discMode = "amt";
  if (q.discAmt == null) q.discAmt = 0;
  if (q.discPct == null) q.discPct = 0;
  if (q.freight == null) q.freight = 0;
  if (q.tariffPct == null) q.tariffPct = machine && machine.isImport ? settings.tariff || 0 : 0;
  if (q.taxPct == null) q.taxPct = 0;
  if (q.lostReason == null) q.lostReason = "";
  if (q.cost == null) q.cost = Math.round((+q.base || 0) * 0.72);
  if (!q.activity || !q.activity.length) q.activity = deriveActivity(q);
  if (!q.config) {
    q.config = {};
    if (machine && machine.cfg && machine.cfg.axes) machine.cfg.axes.forEach((ax) => (q.config![ax.key] = ax.default));
  }
  if (!q.cfgOpts) q.cfgOpts = [];
  return q;
}

export function blankQuote(machineId: string | null, catalog: QcMachine[], settings: QcSettings, existingCount: number): QcQuote {
  const id = machineId || "vcs-12-75";
  const m = catalog.find((x) => x.id === id) || null;
  const today = nowISO();
  const q: QcQuote = {
    id: "q" + Date.now(),
    token: genToken(),
    number: genNumber(existingCount),
    status: "draft",
    machineId: id,
    clientCompany: "",
    clientContact: "",
    clientDept: "",
    clientCity: "",
    clientEmail: "",
    po: "",
    base: m ? m.base : 0,
    crating: m ? m.crating : 0,
    addons: [],
    parts: [],
    discMode: "amt",
    discAmt: 0,
    discPct: 0,
    freight: 0,
    tariffPct: m && m.isImport ? settings.tariff || 0 : 0,
    taxPct: 0,
    cost: Math.round((m ? m.base : 0) * 0.72),
    payment: m ? m.payment : "50-50",
    lead: m ? m.lead : "",
    warranty: m ? m.warranty : "",
    validity: settings.validity,
    roiOn: !!(m && m.roi),
    roiCores: 30,
    roiDays: 250,
    rep: settings.rep,
    notes: "",
    signedName: "",
    signedDate: "",
    createdAt: today,
    lostReason: "",
    followUpDate: "",
    followUpNote: "",
    followUpDone: false,
    activity: [{ type: "created", date: today }],
  };
  initConfig(q, m);
  return q;
}

/* --------------------------------------------------------------- sorting --- */

export interface PipeSort {
  key: string;
  dir: "asc" | "desc";
}

export function nextPipeSort(cur: PipeSort, key: string): PipeSort {
  let dir: "asc" | "desc";
  if (cur.key === key) dir = cur.dir === "asc" ? "desc" : "asc";
  else dir = key === "value" || key === "created" ? "desc" : "asc";
  return { key, dir };
}

export function sortQuotes(list: QcQuote[], ps: PipeSort, machineOf: (q: QcQuote) => QcMachine | null): QcQuote[] {
  const key = ps.key;
  if (!key) return list;
  const sgn = ps.dir === "asc" ? 1 : -1;
  const ord = ["draft", "sent", "accepted", "won", "lost"];
  const val = (q: QcQuote): string | number => {
    const m = machineOf(q);
    switch (key) {
      case "number":
        return (q.number || "").toLowerCase();
      case "client":
        return (q.clientCompany || "").toLowerCase();
      case "machine":
        return (m ? m.name : "parts quote").toLowerCase();
      case "created":
        return q.createdAt || "";
      case "value":
        return cashTotal(q, m);
      case "status":
        return ord.indexOf(q.status);
      default:
        return 0;
    }
  };
  return list.slice().sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va < vb) return -sgn;
    if (va > vb) return sgn;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

/* ---------------------------------------------------------------- badges --- */

export function statusMeta(st: QcStatus) {
  const M: Record<string, { label: string; badge: string; dot: string }> = {
    draft: { label: "Draft", badge: "", dot: "var(--paper-faint)" },
    sent: { label: "Sent", badge: "info", dot: "var(--jme-blue)" },
    accepted: { label: "Accepted", badge: "stock", dot: "var(--jme-green)" },
    won: { label: "Won", badge: "stock", dot: "var(--jme-green)" },
    lost: { label: "Lost", badge: "out", dot: "var(--jme-red)" },
  };
  return M[st] || M.draft;
}

export function badgeCls(st: QcStatus): string {
  const m = statusMeta(st);
  return "jme-badge" + (m.badge ? " jme-badge--" + m.badge : "");
}

export function stockBadge(s: string): string {
  s = (s || "").toLowerCase();
  if (s.indexOf("out") >= 0) return "jme-badge jme-badge--muted";
  if (s.indexOf("low") >= 0) return "jme-badge jme-badge--lead";
  if (s.indexOf("stock") >= 0) return "jme-badge jme-badge--stock";
  if (s.indexOf("lead") >= 0 || s.indexOf("quote") >= 0) return "jme-badge jme-badge--lead";
  return "jme-badge jme-badge--info";
}

/* --------------------------------------------------------- quote document --- */

/**
 * Build the client-facing quote document model. CLIENT-SAFE: carries no
 * cost, margin, or internal fields — exactly what /q/[id] may render.
 */
export function buildDoc(qIn: QcQuote | null, machine: QcMachine | null, settings: QcSettings): QuoteDocModel | null {
  if (!qIn) return null;
  const q = qIn;
  const m = machine;
  const s = settings;
  const photo = m ? m.photo || "" : "";
  const base = +q.base || 0;
  const crating = +q.crating || 0;
  const addonRows = (q.addons || []).filter((a) => a.label || a.amount).map((a) => ({ label: a.label || "Option", amount: usd2(+a.amount || 0) }));
  const cfgRows = cfgOptionLines(q, m).map((o) => ({ label: o.label, amount: usd2(o.amount) }));
  const partRows = (q.parts || []).map((p) => ({
    label: `${p.name}${p.qty > 1 ? " ×" + p.qty : ""} (${p.sku})`,
    amount: p.rfq ? "RFQ" : usd2((+p.qty || 0) * (+p.price || 0)),
  }));
  const pb = priceBreak(q, m);
  const total = pb.total;
  const consultation = total <= 0;
  const rows: { label: string; amount: string }[] = [];
  if (base > 0) rows.push({ label: m ? "Base Equipment Price" : "Parts & Components Subtotal", amount: usd2(base) });
  if (crating > 0) rows.push({ label: "Crating & Export Packaging", amount: usd2(crating) });
  cfgRows.forEach((r) => rows.push(r));
  addonRows.forEach((r) => rows.push(r));
  partRows.forEach((r) => rows.push(r));
  if (!rows.length) rows.push({ label: "Configuration & pricing by consultation", amount: "—" });
  const totals: { label: string; amount: string; red?: boolean }[] = [];
  if (!consultation) {
    totals.push({ label: "Subtotal", amount: usd2(pb.subtotal) });
    if (pb.discount > 0)
      totals.push({ label: "Discount" + (q.discMode === "pct" ? " (" + (+q.discPct! || 0) + "%)" : ""), amount: "−" + usd2(pb.discount), red: true });
    if (pb.tariff > 0) totals.push({ label: "Import tariff (" + pb.tariffPct + "%)", amount: usd2(pb.tariff) });
    if (pb.freight > 0) totals.push({ label: "Freight (estimated)", amount: usd2(pb.freight) });
    if (pb.tax > 0) totals.push({ label: "Sales tax (" + pb.taxPct + "%)", amount: usd2(pb.tax) });
  }
  let payment: { label: string; amount: string }[];
  if (consultation) payment = [{ label: "Payment terms by consultation", amount: "—" }];
  else if (q.payment === "30-60-10") {
    const [a, b, c] = splitPayment(total, [0.3, 0.6, 0.1]);
    payment = [
      { label: "30% Due at Purchase Order", amount: usd2(a) },
      { label: "60% Due Before Shipment", amount: usd2(b) },
      { label: "10% Due at Delivery", amount: usd2(c) },
    ];
  } else if (q.payment === "net30") payment = [{ label: "Net 30 from Invoice Date", amount: usd2(total) }];
  else {
    const [a, b] = splitPayment(total, [0.5, 0.5]);
    payment = [
      { label: "50% Due at Purchase Order", amount: usd2(a) },
      { label: "50% Due at Shipment", amount: usd2(b) },
    ];
  }
  let roi: QuoteDocModel["roi"] = { show: false };
  if (q.roiOn && m && m.roi) {
    const cores = +q.roiCores || 0;
    const days = +q.roiDays || 0;
    const annual = Math.round(cores * days * 2.2);
    const payback = total > 0 && annual > 0 ? Math.max(1, Math.round((total / annual) * 12)) : 0;
    const net5 = annual * 5 - total;
    roi = { show: true, head: `ROI Summary — ${cores} cores/day × ${days} days/year`, annual: usd(annual), payback: payback + " mo", net5: usd(net5) };
  }
  const clientLine = [[q.clientContact, q.clientDept].filter(Boolean).join(" · "), q.clientCity, q.po ? "PO: " + q.po : ""]
    .filter(Boolean)
    .join(" ");
  const accepted = q.status === "accepted" || q.status === "won";
  const rfqBuild = q.rfqBuild;
  // A machine the desk has not attached to a Quote Center entry yet. It is
  // still equipment: heading it "Replacement Parts & Components" with a
  // parts-desk spec block describes a different order entirely.
  const unattached = !m && !!rfqBuild;
  const specs: QcSpec[] = m
    ? machineSpecs(q, m)
    : rfqBuild
    ? rfqBuild.specs
    : [
        { k: "Order Type", v: "Replacement Parts" },
        { k: "Supplier", v: "JM Equipment Inc." },
        { k: "Origin", v: "Sturgis, MI" },
        { k: "Support", v: "24/7 parts desk" },
      ];
  return {
    number: q.number,
    kicker: m || unattached ? "Quotation" : "Parts Quotation",
    validity: q.validity || s.validity,
    validUntil: expiryInfo(q).untilStr,
    fob: s.fob,
    machineName: m ? m.name : rfqBuild ? rfqBuild.name : "Replacement Parts & Components",
    machineSubtitle: m || rfqBuild
      ? resolvedSubtitle(q, m)
      : `${(q.parts || []).length} line item${(q.parts || []).length === 1 ? "" : "s"}`,
    sku: m || rfqBuild ? resolvedSku(q, m) : "JME-PARTS",
    hasPhoto: !!photo,
    photo,
    desc: m
      ? m.desc
      : rfqBuild
      ? rfqBuild.desc
      : "Genuine and refurbished replacement parts supplied and supported by JM Equipment Inc. from Sturgis, Michigan — same-day shipping on stocked items.",
    client: { company: q.clientCompany || "—", line: clientLine || "—" },
    company: { name: s.company, addr: s.addr, phone: s.phone, email: s.email },
    rep: q.rep || s.rep,
    badges: [
      { b: "EST. 1989", s: "Serving Industry" },
      // "Genuine" / "Same-Day" are the parts desk's terms. On equipment with no
      // catalogue entry behind it yet, they promise a stock item's lead time
      // for a machine that has not even been priced.
      { b: q.warranty || (m ? m.warranty : unattached ? "By Consultation" : "Genuine"), s: "Warranty" },
      { b: q.lead || (m ? m.lead : unattached ? "By Consultation" : "Same-Day"), s: "Lead Time" },
      { b: "FOB", s: s.fob },
    ],
    consultation,
    specs,
    hasPackage: !!(m && m.pkg && m.pkg.length),
    package: ((m && m.pkg) || []).map((t) => ({ t })),
    pricing: {
      rows,
      totals,
      total: consultation ? "By Consultation" : usd2(total),
      totalLabel: "Total Quote Amount",
      payment,
      leadTime: q.lead || (m ? m.lead : unattached ? "By Consultation" : "Per line item"),
      warranty: q.warranty || (m ? m.warranty : unattached ? "By Consultation" : "Per part"),
    },
    roi,
    hasDisclosures: !!(m && m.roi),
    disclosures: m && m.roi ? DISCLOSURES.map((t) => ({ t })) : [],
    roiDisclaimer: "* Estimates only. Not a financial guarantee. Based on industry averages at time of quote.",
    terms: TERM_TPL.map((t) => ({ t: t.t, d: t.d.replace("{VALIDITY}", String(q.validity || s.validity)).replace("{FOB}", s.fob) })),
    accepted,
    signed: { name: q.signedName || "", date: q.signedDate || "" },
  };
}
