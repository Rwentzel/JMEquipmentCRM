/**
 * Quote Center — pure pricing engine and types (no I/O, fully unit-tested).
 *
 * Ported from the JME Quote Center design (Claude Design handoff). Money math:
 * subtotal (base + crating + config options + add-ons + priced parts)
 * → discount (amount or %) → import tariff (% of BASE only) → freight
 * → sales tax (% of discounted subtotal) → total. Margin = discounted
 * subtotal − internal cost. Stage-weighted forecast: draft 25% · sent 55%
 * · accepted 90% · won 100% · lost 0%.
 *
 * DATA PROTECTION: everything here is INTERNAL (sell prices, cost, margin).
 * Server-side / ops-authed surfaces only — never imported from public pages.
 */

export type QuoteStatus = "draft" | "sent" | "accepted" | "won" | "lost";
export type PaymentPlan = "50-50" | "30-60-10" | "net30";

export interface QcAddon {
  label: string;
  amount: number;
}

export interface QcPartLine {
  sku: string;
  name: string;
  qty: number;
  price: number;
  /** True when the line is quoted separately (no price yet). */
  rfq: boolean;
}

export interface QcActivity {
  type: "created" | "draft" | "sent" | "viewed" | "accepted" | "won" | "lost";
  date: string;
  by?: string;
}

export interface Quote {
  id: string;
  /** Unguessable token gating the customer view/accept link. */
  shareToken: string;
  number: string;
  status: QuoteStatus;
  /** Equipment id from the qc catalog, or null for a parts-only quote. */
  machineId: string | null;
  clientCompany: string;
  clientContact: string;
  clientDept: string;
  clientCity: string;
  clientEmail: string;
  po: string;
  base: number;
  crating: number;
  addons: QcAddon[];
  parts: QcPartLine[];
  discMode: "amt" | "pct";
  discAmt: number;
  discPct: number;
  freight: number;
  tariffPct: number;
  taxPct: number;
  /** Internal cost basis for margin — never shown on customer surfaces. */
  cost: number;
  payment: PaymentPlan;
  lead: string;
  warranty: string;
  validity: number;
  rep: string;
  notes: string;
  lostReason: string;
  signedName: string;
  signedDate: string;
  createdAt: string;
  updatedAt?: string;
  followUpDate: string;
  followUpNote: string;
  followUpDone: boolean;
  activity: QcActivity[];
}

export interface QcClient {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  industry: string;
  notes: string;
}

export interface QcSettings {
  company: string;
  addr: string;
  phone: string;
  email: string;
  fob: string;
  rep: string;
  /** Default import tariff % applied to imported equipment. */
  tariff: number;
  /** Default quote validity in days. */
  validity: number;
}

export interface QcMachineOption {
  key: string;
  label: string;
  amount: number;
}

export interface QcMachine {
  id: string;
  cat: string;
  badge: string;
  sku: string;
  name: string;
  sub: string;
  desc: string;
  specs: Array<{ k: string; v: string }>;
  /** Internal sell price. 0 = by consultation. */
  base: number;
  crating: number;
  warranty: string;
  lead: string;
  payment: PaymentPlan;
  isImport: boolean;
  /** Included-package bullets shown on the quote document. */
  pkg: string[];
  options: QcMachineOption[];
}

export const DEFAULT_SETTINGS: QcSettings = {
  company: "JM Equipment Inc.",
  addr: "405½ W. Congress St., Sturgis, MI 49091",
  phone: "(269) 659-0093",
  email: "sales@jmequipment.net",
  fob: "Sturgis, MI",
  rep: "",
  tariff: 15,
  validity: 60,
};

export const LOSS_REASONS = [
  "Price",
  "Lead time",
  "Lost to competitor",
  "Budget / timing",
  "Project cancelled",
  "No decision",
  "Other",
];

export const QC_TERMS: Array<{ t: string; d: string }> = [
  { t: "Quotation Validity", d: "This quotation is valid for {VALIDITY} calendar days from the date of issue. Prices are in USD." },
  { t: "Equipment Condition", d: "Equipment is sold as specified. Refurbished units per JME condition report; new units per OEM specification." },
  { t: "FOB Terms", d: "All shipments are FOB {FOB} unless otherwise agreed in writing." },
  { t: "Warranty Coverage", d: "New JME-manufactured equipment: 1 year. Goodstrong new equipment: 12 months. Martin refurbished: 6 months." },
  { t: "Warranty Exclusions", d: "Warranty does not cover normal wear, consumables, misuse, unauthorized repair, or modification." },
  { t: "Freight & Tariffs", d: "Freight and import duties are buyer responsibility unless stated. Tariff rates reflect the rate at time of quote and are subject to change." },
  { t: "Governing Law", d: "This agreement is governed by the laws of the State of Michigan, United States." },
  { t: "Acceptance", d: "Equipment ordered or PO issued constitutes acceptance of these terms and conditions." },
];

export function usd(n: number): string {
  return "$" + Math.round(+n || 0).toLocaleString("en-US");
}

export function usd2(n: number): string {
  return "$" + Number(+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function lineSubtotal(q: Quote): number {
  const add = (q.addons || []).reduce((t, a) => t + (+a.amount || 0), 0);
  const parts = (q.parts || []).reduce((t, p) => t + (p.rfq ? 0 : (+p.qty || 0) * (+p.price || 0)), 0);
  return (+q.base || 0) + (+q.crating || 0) + add + parts;
}

export function discountAmt(q: Quote, sub = lineSubtotal(q)): number {
  if ((q.discMode || "amt") === "pct") return Math.round(sub * (+q.discPct || 0) / 100);
  return Math.min(sub, Math.round(+q.discAmt || 0));
}

export interface PriceBreak {
  subtotal: number;
  discount: number;
  afterDisc: number;
  tariff: number;
  tariffPct: number;
  freight: number;
  tax: number;
  taxPct: number;
  total: number;
  cost: number;
  marginAmt: number;
  marginPct: number;
}

export function priceBreak(q: Quote): PriceBreak {
  const subtotal = lineSubtotal(q);
  const discount = discountAmt(q, subtotal);
  const afterDisc = Math.max(0, subtotal - discount);
  const tariffPct = +q.tariffPct || 0;
  const tariff = Math.round((+q.base || 0) * tariffPct / 100);
  const freight = Math.round(+q.freight || 0);
  const taxPct = +q.taxPct || 0;
  const tax = Math.round(afterDisc * taxPct / 100);
  const total = afterDisc + tariff + freight + tax;
  const cost = Math.round(+q.cost || 0);
  const marginAmt = afterDisc - cost;
  const marginPct = afterDisc > 0 ? Math.round((marginAmt / afterDisc) * 100) : 0;
  return { subtotal, discount, afterDisc, tariff, tariffPct, freight, tax, taxPct, total, cost, marginAmt, marginPct };
}

const STAGE_PROB: Record<QuoteStatus, number> = { draft: 0.25, sent: 0.55, accepted: 0.9, won: 1, lost: 0 };

export function stageProb(status: QuoteStatus): number {
  return STAGE_PROB[status] ?? 0;
}

export function weightedTotal(q: Quote): number {
  return Math.round(priceBreak(q).total * stageProb(q.status));
}

/** Payment schedule rows for the quote document. */
export function paymentSchedule(plan: PaymentPlan, total: number): Array<{ label: string; amount: string }> {
  if (total <= 0) return [{ label: "Payment terms by consultation", amount: "—" }];
  if (plan === "30-60-10")
    return [
      { label: "30% Due at Purchase Order", amount: usd2(total * 0.3) },
      { label: "60% Due Before Shipment", amount: usd2(total * 0.6) },
      { label: "10% Due at Delivery", amount: usd2(total * 0.1) },
    ];
  if (plan === "net30") return [{ label: "Net 30 from Invoice Date", amount: usd2(total) }];
  return [
    { label: "50% Due at Purchase Order", amount: usd2(total / 2) },
    { label: "50% Due at Shipment", amount: usd2(total / 2) },
  ];
}

export interface ExpiryInfo {
  expired: boolean;
  daysLeft: number | null;
  untilStr: string;
  active: boolean;
  label: string;
}

export function expiryInfo(q: Quote, now = new Date()): ExpiryInfo {
  if (!q.createdAt) return { expired: false, daysLeft: null, untilStr: "", active: false, label: "" };
  const created = new Date(q.createdAt + "T00:00:00");
  if (isNaN(created.getTime())) return { expired: false, daysLeft: null, untilStr: "", active: false, label: "" };
  const exp = new Date(created);
  exp.setDate(exp.getDate() + (+q.validity || 60));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((exp.getTime() - today.getTime()) / 86_400_000);
  const expired = daysLeft < 0;
  const active = q.status === "draft" || q.status === "sent";
  return {
    expired,
    daysLeft,
    untilStr: exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    active,
    label: expired ? "Expired" : `${daysLeft}${daysLeft === 1 ? " day left" : " days left"}`,
  };
}

/** Q-YY-MMDD-NN quote number. */
export function genNumber(seq: number, now = new Date()): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `Q-${yy}-${mm}${dd}-${String(seq).padStart(2, "0")}`;
}

/** Terms with validity/FOB substituted. */
export function resolvedTerms(validity: number, fob: string): Array<{ t: string; d: string }> {
  return QC_TERMS.map((t) => ({ t: t.t, d: t.d.replace("{VALIDITY}", String(validity)).replace("{FOB}", fob) }));
}
