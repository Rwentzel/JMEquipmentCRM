/**
 * JME Parts Store — data contracts (RFQ-first).
 *
 * DATA PROTECTION: these interfaces carry PUBLIC, customer-safe fields only.
 * There is intentionally NO field for sell price, cost, margin, exact quantity,
 * vendor name, vendor part number, OEM cross-reference, internal alias,
 * bin location, supplier notes, or QuickBooks references. See DATA_BOUNDARIES.md.
 */

export type BadgeStatus = "default" | "stock" | "lead" | "out" | "info";
export type TagTone = "default" | "consult" | "blue" | "red" | "green";

/** The ONLY availability labels allowed on public pages. No exact counts, ever. */
export type StatusBand =
  | "In Stock"
  | "Limited Stock"
  | "Backorder"
  | "Call for Availability"
  | "Quote Required"
  | "Freight Quote Required"
  | "Discontinued / Contact JM";

export const STATUS_BANDS: StatusBand[] = [
  "In Stock",
  "Limited Stock",
  "Backorder",
  "Call for Availability",
  "Quote Required",
  "Freight Quote Required",
  "Discontinued / Contact JM",
];

/** RFQ-first action that drives the public CTA. No public "Buy Now". */
export type RfqAction = "request-quote" | "call" | "freight-quote" | "backorder" | "contact";

export interface SpecRow {
  k: string;
  v: string;
}

export interface Machine {
  sku: string;
  name: string;
  family: string;
  tag: TagTone;
  tagLabel: string;
  statusBand: StatusBand;
  action: RfqAction;
  /** Filename under /public/images, or null → branded placeholder. */
  photo: string | null;
  fit?: "contain" | "cover";
  blurb: string;
  specs: SpecRow[];
}

export interface Part {
  sku: string;
  name: string;
  /** Machine-family category used for filtering. */
  cat: string;
  statusBand: StatusBand;
  action: RfqAction;
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

/** A line item on the customer's RFQ list (localStorage-backed). No price. */
export interface RequestItem {
  sku: string;
  name: string;
  qty: number;
}

/* ---- Machine detail (deep content for /machine/[sku]) ---- */
/* Configurator options carry NO prices — selecting them builds an RFQ spec. */

export interface DetailChoice {
  v: string;
  sku: string;
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
  badge: { band: StatusBand };
  gallery: GalleryItem[];
  options: DetailOption[];
  how: HowStep[];
  apps: string[];
  proof: Proof;
  partsCat: string;
  downloads: Download[];
}
