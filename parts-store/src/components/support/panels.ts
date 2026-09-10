import type { SupportType } from "@/lib/supportRequests";

/**
 * The six help paths. `key` is the `?panel=` deep link (the design references'
 * own keys, so links in emails and signatures keep working across tracks).
 */
export interface PanelDef {
  key: "guides" | "manual" | "service" | "fitment" | "epc" | "contact";
  kicker: string;
  card: string;
  blurb: string;
  cta: string;
  /** Panel heading (differs from the card on a few). */
  title: string;
  intro: string;
  /** The typed request this panel submits; guides is text only. */
  type: SupportType | null;
  submit?: string;
  note?: string;
}

export const PANELS: PanelDef[] = [
  {
    key: "guides",
    kicker: "Self-serve",
    card: "Troubleshooting",
    blurb: "Common issues, maintenance schedules, and first-aid steps for Goodstrong, Martin, and JME equipment.",
    cta: "Browse guides",
    title: "Troubleshooting",
    intro: "Start here for the issues we field most often. If your symptom is not listed, the desk would rather hear it described than have you guess.",
    type: null,
  },
  {
    key: "manual",
    kicker: "Documents",
    card: "Manuals & documentation",
    blurb: "OEM manuals, parts lists, assembly drawings, and electrical schematics. Request by machine serial or model.",
    cta: "Request manual",
    title: "Request a manual",
    intro: "Tell us the serial and what document you need. Manuals are matched to the machine as built, not to the model in general.",
    type: "manual-request",
    submit: "Request documentation",
    note: "Documentation availability varies by machine and publisher. We send what we hold and tell you plainly what we do not.",
  },
  {
    key: "service",
    kicker: "Field service",
    card: "Service & repairs",
    blurb: "Field service, on-site diagnostics, component refurbishment, and emergency support. Call or submit a request.",
    cta: "Request service",
    title: "Request field service",
    intro: "Describe what the machine is doing. The more specific the symptom, the better the odds we arrive with the right parts on the truck.",
    type: "service-request",
    submit: "Submit service request",
    note: "This is a service request, not a scheduled visit. We confirm timing, scope, and travel in writing before anyone is dispatched.",
  },
  {
    key: "fitment",
    kicker: "Verification",
    card: "Fitment confirmation",
    blurb: "Unsure if a part fits your machine? Provide the serial number and model; we'll verify compatibility.",
    cta: "Confirm fitment",
    title: "Confirm fitment",
    intro: "Fitment on converting equipment depends on serial number, model year, and how the line was configured. Send us both numbers and we will confirm before anything ships.",
    type: "fitment-check",
    submit: "Request fitment check",
    note: "Fitment is confirmed in writing by the parts desk. Anything we say on the phone gets repeated in the reply so you have it on record.",
  },
  {
    key: "epc",
    kicker: "Diagrams",
    card: "Parts diagrams (EPC)",
    blurb: "Balloon references and exploded views, tied to a machine serial. Enter your serial to see what we hold.",
    cta: "Check a serial",
    title: "Parts diagrams (EPC)",
    intro: "Diagrams are held per serial, not per model. Enter your serial and we will tell you exactly what documentation is on file.",
    type: "epc-lookup",
    submit: "Check this serial",
    note: "Diagram coverage is uneven across imported machines. Where linkage is pending we say so rather than showing a diagram from a different build.",
  },
  {
    key: "contact",
    kicker: "Sales",
    card: "Contact sales",
    blurb: "Equipment purchases, custom configurations, financing, and partnership inquiries.",
    cta: "Message sales",
    title: "Contact sales",
    intro: "Purchases, rebuilds, and configuration questions go to Sturgis directly. No figures are published online — every machine is quoted against your line.",
    type: "sales-inquiry",
    submit: "Send message",
    note: "A sales conversation is a request for a firm written quotation, not a binding order. Lead times are confirmed at quote.",
  },
];

export type PanelKey = PanelDef["key"];

export function isPanelKey(v: string | null): v is PanelKey {
  return !!v && PANELS.some((p) => p.key === v);
}

/** What the desk is currently fielding. Copy is final; the third is the pending-linkage note. */
export const KNOWN_ISSUES: { title: string; body: string; pending?: boolean }[] = [
  {
    title: "Goodstrong 1650 hydraulic noise",
    body: "If you hear elevated pump noise during idle, check reservoir oil level and coolant saturation. Most cases resolve with a 100-micron filter change.",
  },
  {
    title: "Martin rollstand bearing wear",
    body: "Spindle roughness under load may indicate bearing preload drift. Contact JME service for inspection and replacement kit.",
  },
  {
    title: "SN 26218 EPC — diagram linkage pending",
    body: "Diagram linkage is pending receipt of current documentation from the publisher. Request a manual or a specific parts list in the meantime, or call the desk and describe the assembly.",
    pending: true,
  },
];

/** Serials the desk has flagged as pending diagram linkage — echoed live in the EPC panel. */
export const PENDING_EPC_SERIALS = ["26218"];
