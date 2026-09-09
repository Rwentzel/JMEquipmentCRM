/**
 * Support Hub requests.
 *
 * The five typed forms on /support — manual, field service, fitment check,
 * EPC serial lookup, sales — are described once here, and that one spec does
 * three jobs: the page renders its fields from it, the browser validates
 * against it, and the API validates against it again before anything is
 * stored. A select answer is checked against our own option text, so for
 * those fields what reaches the desk email and the CSV is text from this
 * file, never text a customer typed. Free text is trimmed and capped.
 *
 * Pure: no I/O, no framework — importable from client components and
 * unit-testable directly. Prices never appear here: every path ends in a
 * written reply from the desk, the same as a quote request.
 */

import { EMAIL_RE } from "@/lib/validateQuote";

export type SupportKind = "manual-request" | "service-request" | "fitment-check" | "epc-lookup" | "sales-inquiry";

export const SUPPORT_KINDS: readonly SupportKind[] = [
  "manual-request",
  "service-request",
  "fitment-check",
  "epc-lookup",
  "sales-inquiry",
];

export type SupportFieldType = "text" | "email" | "tel" | "textarea" | "select";

export interface SupportField {
  key: string;
  label: string;
  type: SupportFieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Select choices. Stored verbatim, so this list is the only text a select can contribute. */
  options?: readonly string[];
  /** Free-text cap; defaults by type. */
  max?: number;
  /**
   * Where the answer lands on the stored record. Contact-shaped answers go on
   * the contact block the ops inbox and the desk email already read; the
   * free-text "what is wrong" goes in the message; everything else becomes a
   * labelled detail line.
   */
  to?: "name" | "company" | "email" | "phone" | "serial" | "message";
}

export interface SupportForm {
  kind: SupportKind;
  /** Short uppercase tag for the ops inbox flag and the email subject. */
  tag: string;
  /** How the desk email and the confirmation name the request. */
  label: string;
  eyebrow: string;
  title: string;
  lead: string;
  submit: string;
  /** The fine print under the form: what this request is and is not. */
  fine: string;
  /** A place to go meanwhile (the EPC panel points at the published pages). */
  aside?: { label: string; href: string };
  fields: readonly SupportField[];
}

const MODELS = [
  "Goodstrong GMC-TC II 1650",
  "Goodstrong GMC-TC 1600-E",
  "Martin sheeter or rollstand",
  "JME vertical core splitter",
  "Other / not sure",
] as const;

export const SUPPORT_FORMS: Record<SupportKind, SupportForm> = {
  "manual-request": {
    kind: "manual-request",
    tag: "MANUAL",
    label: "Manual request",
    eyebrow: "Documents",
    title: "Request a manual",
    lead: "Tell us the serial and what document you need. Manuals are matched to the machine as built, not to the model in general.",
    submit: "Request documentation",
    fine: "Documentation availability varies by machine and publisher. We send what we hold and tell you plainly what we do not.",
    fields: [
      {
        key: "serial",
        label: "Machine serial number",
        type: "text",
        required: true,
        to: "serial",
        hint: "the dataplate photo works fine if the number is hard to read",
        placeholder: "e.g. SN-26218 or GS-1650-B-2019",
      },
      { key: "model", label: "Machine model", type: "select", required: true, placeholder: "Select a model", options: MODELS },
      {
        key: "docType",
        label: "What documentation do you need?",
        type: "select",
        placeholder: "Select documentation type",
        options: ["Operator manual", "Parts list & diagram", "Electrical schematic", "Service manual", "All available documentation"],
      },
      { key: "email", label: "Email address", type: "email", required: true, to: "email", placeholder: "you@company.com" },
    ],
  },
  "service-request": {
    kind: "service-request",
    tag: "SERVICE",
    label: "Field service request",
    eyebrow: "Field service",
    title: "Request field service",
    lead: "Describe what the machine is doing. The more specific the symptom, the better the odds we arrive with the right parts on the truck.",
    submit: "Submit service request",
    fine: "This is a service request, not a scheduled visit. We confirm timing, scope, and travel in writing before anyone is dispatched.",
    fields: [
      { key: "name", label: "Your name", type: "text", required: true, to: "name" },
      { key: "company", label: "Company", type: "text", to: "company" },
      {
        key: "phone",
        label: "Phone",
        type: "tel",
        required: true,
        to: "phone",
        hint: "best number to reach the person standing at the machine",
      },
      { key: "email", label: "Email", type: "email", to: "email", hint: "where the written confirmation goes" },
      { key: "serial", label: "Machine serial number", type: "text", to: "serial", placeholder: "e.g. SN-26218" },
      {
        key: "issue",
        label: "Describe the issue",
        type: "textarea",
        required: true,
        to: "message",
        placeholder: "Symptoms, error codes, when it started, parts that may be affected…",
      },
      {
        key: "serviceType",
        label: "Service type",
        type: "select",
        placeholder: "Select",
        options: ["Diagnostic / troubleshooting", "Repair or component replacement", "Refurbishment / rebuild", "Installation support"],
      },
    ],
  },
  "fitment-check": {
    kind: "fitment-check",
    tag: "FITMENT",
    label: "Fitment check",
    eyebrow: "Verification",
    title: "Confirm fitment",
    lead: "Fitment on converting equipment depends on serial number, model year, and how the line was configured. Send us both numbers and we will confirm before anything ships.",
    submit: "Request fitment check",
    fine: "Fitment is confirmed in writing by the parts desk. Anything we say on the phone gets repeated in the reply so you have it on record.",
    fields: [
      { key: "sku", label: "Part SKU", type: "text", required: true, placeholder: "e.g. MB2G2011011" },
      { key: "machine", label: "Machine serial or model", type: "text", required: true, placeholder: "e.g. SN-26218 or Goodstrong 1650" },
      {
        key: "context",
        label: "Additional context",
        type: "textarea",
        to: "message",
        placeholder: "Assembly location, replacement scenario, any other details that help us confirm…",
      },
      { key: "email", label: "Contact email", type: "email", required: true, to: "email" },
    ],
  },
  "epc-lookup": {
    kind: "epc-lookup",
    tag: "EPC",
    label: "Parts diagram lookup",
    eyebrow: "Diagrams",
    title: "Parts diagrams (EPC)",
    lead: "Diagrams are held per serial, not per model. Enter your serial and we will tell you exactly what documentation is on file.",
    submit: "Check this serial",
    fine: "Diagram coverage is uneven across imported machines. Where linkage is pending we say so rather than showing a diagram from a different build.",
    aside: { label: "Browse the published Goodstrong pages meanwhile", href: "/parts/goodstrong" },
    fields: [
      { key: "serial", label: "Machine serial number", type: "text", required: true, to: "serial", placeholder: "e.g. SN-26218" },
      { key: "email", label: "Email address", type: "email", required: true, to: "email", placeholder: "you@company.com" },
    ],
  },
  "sales-inquiry": {
    kind: "sales-inquiry",
    tag: "SALES",
    label: "Sales inquiry",
    eyebrow: "Sales",
    title: "Contact sales",
    lead: "Purchases, rebuilds, and configuration questions go to Sturgis directly. No figures are published online — every machine is quoted against your line.",
    submit: "Send message",
    fine: "A sales conversation is a request for a firm written quotation, not a binding order. Lead times are confirmed at quote.",
    fields: [
      { key: "name", label: "Your name", type: "text", required: true, to: "name" },
      { key: "company", label: "Company", type: "text", to: "company" },
      { key: "email", label: "Email", type: "email", required: true, to: "email" },
      { key: "phone", label: "Phone", type: "tel", to: "phone" },
      {
        key: "topic",
        label: "What can we help with?",
        type: "select",
        required: true,
        placeholder: "Select",
        options: ["Equipment purchase or quote", "Custom configuration", "Financing or leasing", "Partnership or reseller inquiry", "Other"],
      },
      { key: "message", label: "Message", type: "textarea", to: "message", placeholder: "Tell us about your line and what it needs to do…" },
    ],
  },
};

const MAX: Record<SupportFieldType, number> = { text: 200, email: 320, tel: 40, textarea: 4000, select: 200 };

export function isSupportKind(v: unknown): v is SupportKind {
  return typeof v === "string" && (SUPPORT_KINDS as readonly string[]).includes(v);
}

/** Field-level problems, keyed by field, in the words the form shows. Empty when the form is fine. */
export function fieldErrors(form: SupportForm, values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of form.fields) {
    const v = String(values[f.key] ?? "").trim();
    if (!v) {
      if (f.required) errors[f.key] = `${f.label} is required.`;
      continue;
    }
    if (f.type === "select" && !(f.options ?? []).includes(v)) errors[f.key] = "Choose one of the listed options.";
    else if (f.type === "email" && !EMAIL_RE.test(v)) errors[f.key] = "Enter a valid email.";
  }
  return errors;
}

export interface SupportContact {
  company: string;
  name: string;
  email: string;
  phone?: string;
  serial?: string;
}

export interface SupportRequest {
  kind: SupportKind;
  contact: SupportContact;
  /** Labelled answers in the form's own order. Select values are our option text. */
  details: Record<string, string>;
  message?: string;
}

export type SupportOutcome =
  | { kind: "honeypot" } // pretend success, ignore
  | { kind: "invalid" } // 422 generic
  | { kind: "ok"; request: SupportRequest };

/**
 * Decide how to handle a Support Hub submission and, when it is sound, shape
 * it into the record the store keeps. Never echoes what was typed.
 */
export function evaluateSupport(
  kind: unknown,
  values: Record<string, unknown>,
  meta: { website?: unknown; consent?: unknown },
): SupportOutcome {
  if (String(meta.website ?? "").trim().length > 0) return { kind: "honeypot" };
  if (!isSupportKind(kind)) return { kind: "invalid" };
  if (meta.consent !== true) return { kind: "invalid" };
  const form = SUPPORT_FORMS[kind];
  if (Object.keys(fieldErrors(form, values)).length > 0) return { kind: "invalid" };

  const contact: SupportContact = { company: "", name: "", email: "" };
  const details: Record<string, string> = {};
  let message: string | undefined;
  for (const f of form.fields) {
    const v = String(values[f.key] ?? "").trim().slice(0, f.max ?? MAX[f.type]);
    if (!v) continue;
    switch (f.to) {
      case "name":
        contact.name = v;
        break;
      case "company":
        contact.company = v;
        break;
      case "email":
        contact.email = v;
        break;
      case "phone":
        contact.phone = v;
        break;
      case "serial":
        contact.serial = v;
        break;
      case "message":
        message = v;
        break;
      default:
        details[f.label] = v;
    }
  }
  return { kind: "ok", request: { kind, contact, details, ...(message ? { message } : {}) } };
}
