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
  /** One-line "who this is for" positioning (2026 outcome-led merchandising). */
  bestFor?: string;
  /** Customer outcomes — short proof bullets, never prices or quantities. */
  outcomes?: string[];
}

export interface Part {
  sku: string;
  name: string;
  /** Machine-family category used for filtering. */
  cat: string;
  statusBand: StatusBand;
  action: RfqAction;
  /** Customer-facing description (sanitized — no internal notes). */
  description?: string;
  /** Fine-grained category, e.g. "Blades" — from the internal category legend. */
  category?: string;
  /** Machine fitment, e.g. "TC1600E / TC II". */
  fitment?: string;
  /** Search/SEO keywords — symptom and alternate-name terms customers actually type. */
  keywords?: string[];
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
  /** Optional provenance, e.g. "Goodstrong 1650 · Hydraulics · p.42 · #7" — display only. */
  source?: string;
  /**
   * Where on a manual drawing this part was picked, as ids the server can
   * check against its own diagram data. The desk confirms fit from the page
   * and bubble number — the same part number appears on more than one
   * drawing — so this has to survive submission, and it travels as ids so a
   * crafted `source` string cannot reach the desk email or the CSV export.
   */
  origin?: { model: string; section: string; page: string; bubble: number };
  /**
   * Configurator choices, as DetailChoice skus — never the display text.
   *
   * The desk must know a customer asked for 460V and a 90-inch frame rather
   * than the standard build, and sending ids lets the server resolve the
   * labels from its own data. Nothing the customer can type reaches the desk
   * email or the CSV export by this route.
   */
  options?: string[];
  /**
   * The same choices as text, for the customer's own request list so they can
   * check what they are about to send. DISPLAY ONLY — the server resolves the
   * labels from `options` and never reads this, so nothing here can reach the
   * desk email or the CSV export.
   */
  configLabel?: string;
}

/* ---- Goodstrong manual / exploded-view diagram data ---- */
/* Only ever populated from real manual content — never invented. See data/goodstrong.ts. */

/** A numbered callout on an exploded-view page image, positioned in percent (0-100). */
export interface Hotspot {
  bubble: number;
  x: number;
  y: number;
}

/** One row of a page's parts list, keyed to its callout bubble number(s). */
export interface DiagramPart {
  bubble: number;
  sku: string;
  name: string;
  /** Quantity used in this assembly per the manual's BOM — not a warehouse stock count. */
  qty: number;
  /** Prior/alternate part numbers for the same location across model years or revisions. */
  alsoKnownAs?: string[];
}

/** One exploded-view page within a manual section. */
export interface DiagramPage {
  /** The manual's own page label, e.g. "5-3" or "5d-2-01". */
  pageLabel: string;
  /** Filename under /public/images (manual page scans live in images/manuals/<model>/). */
  image: string;
  caption: string;
  hotspots: Hotspot[];
  parts: DiagramPart[];
}

/** A manual's table-of-contents entry (real section title + page label). */
export interface ManualSection {
  id: string;
  label: string;
  /** The manual's page label for the section start, e.g. "5-3", "5a". */
  pageLabel: string;
  /** The manual's own sub-drawing index for this section (title + page label). */
  drawings?: { title: string; pageLabel: string }[];
}

/** A Goodstrong sheeter model + its manual content. */
export interface GoodstrongModel {
  id: string;
  label: string;
  /** Catalog machine SKU this model maps to, if listed in data/catalog.ts. */
  machineSku?: string;
  photo: string | null;
  serialPattern: string;
  /**
   * Which model's factory catalogue the section index and its page labels were
   * transcribed from. Absent means this model's own. When it names a DIFFERENT
   * model, those page numbers belong to another machine's book and must never
   * be presented to the customer as their own — quoting them down the phone
   * sends the desk to the wrong drawing.
   */
  sectionsFrom?: string;
  sections: ManualSection[];
  diagrams: Record<string, DiagramPage[]>;
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
