/**
 * JME Parts Store — data contracts.
 *
 * DATA PROTECTION: these interfaces are deliberately limited to PUBLIC,
 * customer-safe fields. There is intentionally no field for vendor name,
 * vendor part number, cost, margin, bin location, supplier notes, or
 * QuickBooks references. Internal-only data must never enter these types.
 */

export type BadgeStatus = "default" | "stock" | "lead" | "out" | "info";
export type TagTone = "default" | "consult" | "blue" | "red" | "green";

/** A purchase path determines how a customer can transact on an item. */
export type PurchasePath =
  | "buy-now"
  | "request-quote"
  | "call"
  | "freight-quote"
  | "quote-only"
  | "backorder"
  | "discontinued";

export interface SpecRow {
  k: string;
  v: string;
}

export interface Machine {
  sku: string;
  name: string;
  /** Machine family / category, customer-safe. */
  family?: string;
  tag: TagTone;
  tagLabel: string;
  status: BadgeStatus;
  statusLabel: string;
  /** Filename under /public/images, or null → branded placeholder. */
  photo: string | null;
  fit?: "contain" | "cover";
  blurb: string;
  specs: SpecRow[];
  /** How a customer can transact for this machine. */
  purchasePath: PurchasePath;
}

export interface Part {
  sku: string;
  name: string;
  /** Machine-family category used for filtering. */
  cat: string;
  /** Budgetary price; null means "Call for Price"/quote-only. */
  price: number | null;
  status: BadgeStatus;
  statusLabel: string;
  purchasePath: PurchasePath;
}

export interface Contact {
  company: string;
  tagline: string;
  address: string;
  city: string;
  est: number;
  phone: string;
  email: string;
}

export interface Catalog {
  contact: Contact;
  machines: Machine[];
  parts: Part[];
  cats: string[];
}

/** A line item on the customer's request list (localStorage-backed). */
export interface RequestItem {
  sku: string;
  name: string;
  price: number | null;
  qty: number;
}

/* ---- Machine detail (deep content for /machine/[sku]) ---- */

export interface DetailChoice {
  v: string;
  sku: string;
  price: number;
  note?: string;
}

export interface DetailOption {
  id: string;
  label: string;
  type: "radio" | "check";
  choices: DetailChoice[];
}

export interface GalleryItem {
  src: string;
  cap: string;
  fit?: "contain" | "cover";
}

export interface DetailStat {
  value?: string;
  html?: string;
  label: string;
}

export interface HowStep {
  n: string;
  t: string;
  d: string;
}

export interface Proof {
  stat: string;
  label: string;
  quote: string;
}

export interface Download {
  t: string;
  m: string;
}

export interface MachineDetail {
  tagline: string;
  lead: string;
  heroStats: DetailStat[];
  badge: { status: BadgeStatus; label: string };
  gallery: GalleryItem[];
  /** Budgetary base price (sandbox, indicative only). */
  basePrice: number;
  options: DetailOption[];
  how: HowStep[];
  apps: string[];
  proof: Proof;
  partsCat: string;
  downloads: Download[];
}
