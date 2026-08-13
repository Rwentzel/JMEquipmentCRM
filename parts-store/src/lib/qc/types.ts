/**
 * JME Quote Center — data contracts, ported 1:1 from the design handoff
 * (design_handoff_jme_quote_center/README.md "State Management").
 *
 * INTERNAL SYSTEM: quotes, catalog and parts carry real dealer pricing,
 * cost and margin. Everything here lives behind the ops gate except the
 * client-safe QuoteDocModel, which is what /q/[id] renders for customers.
 */

export type QcStatus = "draft" | "sent" | "accepted" | "won" | "lost";

export interface QcSpec {
  k: string;
  v: string;
}

export interface QcCfgOption {
  key: string;
  label: string;
  amount: number;
}

export interface QcCfgAxisOption {
  v: string;
  label: string;
  base?: number;
  crating?: number;
  cycle?: string;
  lead?: string;
  warranty?: string;
  note?: string;
  consult?: boolean;
}

export interface QcCfgAxis {
  key: string;
  label: string;
  default: string;
  priced?: boolean;
  specLabel?: string;
  options: QcCfgAxisOption[];
}

export interface QcCfg {
  title: string;
  sku?: string;
  subtitle?: string;
  axes?: QcCfgAxis[];
  options?: QcCfgOption[];
}

export interface QcMachine {
  id: string;
  cat: string;
  badge: string;
  sku: string;
  name: string;
  sub: string;
  desc: string;
  specs: QcSpec[];
  base: number;
  crating: number;
  warranty: string;
  lead: string;
  /** Public image path under /public (e.g. "/images/core-splitter.png") or a data: URL uploaded in edit mode. */
  photo: string;
  payment: string;
  isImport: boolean;
  roi: boolean;
  pkg: string[];
  cfg?: QcCfg;
}

export interface QcQuotePart {
  sku: string;
  name: string;
  qty: number;
  price: number;
  rfq: boolean;
}

export interface QcAddon {
  label: string;
  amount: number;
}

export interface QcActivity {
  type: string;
  date: string;
  by?: string;
}

export interface QcQuote {
  id: string;
  number: string;
  status: QcStatus;
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
  parts: QcQuotePart[];
  discMode?: "amt" | "pct";
  discAmt?: number;
  discPct?: number;
  freight?: number;
  tariffPct?: number;
  taxPct?: number;
  cost?: number;
  payment: string;
  lead: string;
  warranty: string;
  validity: number;
  roiOn: boolean;
  roiCores: number;
  roiDays: number;
  rep: string;
  notes: string;
  signedName: string;
  signedDate: string;
  createdAt: string;
  updatedAt?: string;
  lostReason?: string;
  followUpDate: string;
  followUpNote: string;
  followUpDone: boolean;
  activity?: QcActivity[];
  config?: Record<string, string>;
  cfgOpts?: string[];
  /** Capability token for the public /q/[id]/[token] link — the quote id alone is not enough to view it. */
  token?: string;
  /**
   * Optimistic-concurrency counter, bumped by the server on every accepted
   * write. A client PUT carrying a lower rev than the stored copy is a stale
   * snapshot and is refused for that quote — this is what stops a long-open
   * staff tab from overwriting a customer's acceptance.
   */
  rev?: number;
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
  tariff: number;
  markup: number;
  validity: number;
}

export interface QcPart {
  sku: string;
  name: string;
  fam: string;
  cat: string;
  fits: string;
  stock: string;
  price: number;
}

/** The persisted store segments — mirrors prototype localStorage['jme_qc']. */
export interface QcState {
  quotes: QcQuote[];
  clients: QcClient[];
  settings: QcSettings;
  catalog: QcMachine[];
}

export interface QcPriceBreak {
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

/** Client-safe quote document model — NO cost, NO margin (see buildDoc). */
export interface QuoteDocModel {
  number: string;
  kicker: string;
  validity: number;
  validUntil: string;
  fob: string;
  machineName: string;
  machineSubtitle: string;
  sku: string;
  hasPhoto: boolean;
  photo: string;
  desc: string;
  client: { company: string; line: string };
  company: { name: string; addr: string; phone: string; email: string };
  rep: string;
  badges: { b: string; s: string }[];
  consultation: boolean;
  specs: QcSpec[];
  hasPackage: boolean;
  package: { t: string }[];
  pricing: {
    rows: { label: string; amount: string }[];
    totals: { label: string; amount: string; red?: boolean }[];
    total: string;
    totalLabel: string;
    payment: { label: string; amount: string }[];
    leadTime: string;
    warranty: string;
  };
  roi: { show: boolean; head?: string; annual?: string; payback?: string; net5?: string };
  hasDisclosures: boolean;
  disclosures: { t: string }[];
  roiDisclaimer: string;
  terms: { t: string; d: string }[];
  accepted: boolean;
  signed: { name: string; date: string };
}
