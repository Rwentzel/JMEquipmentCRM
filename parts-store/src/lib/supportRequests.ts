/**
 * Typed support requests — the Support Hub's five forms.
 *
 * Shared by the browser (option lists, labels) and the intake route
 * (validation). Pure: no I/O, no framework, importable from client code.
 *
 * Contract mirrors the shared RFQ Worker's `request_type` set so the same
 * vocabulary describes a request whichever track produced it. Every select
 * is resolved server-side against the lists here, so the only customer-typed
 * text that reaches the desk email is the free-text fields, cleaned and capped
 * like the storefront message.
 */

export const SUPPORT_TYPES = [
  "manual-request",
  "service-request",
  "fitment-check",
  "epc-lookup",
  "sales-inquiry",
] as const;

export type SupportType = (typeof SUPPORT_TYPES)[number];

export function isSupportType(v: unknown): v is SupportType {
  return typeof v === "string" && (SUPPORT_TYPES as readonly string[]).includes(v);
}

/** The keys a typed request may carry beyond the contact block. */
export type SupportFieldKey = "machineModel" | "docType" | "serviceType" | "partNumber" | "topic";

export interface SupportTypeSpec {
  label: string;
  /** Short flag for the ops desk row. */
  flag: string;
  /** Contact fields that must be present. */
  required: ("name" | "email" | "phone" | "message" | "serial")[];
  /** At least one of these must be present. */
  requireAnyOf?: ("serial" | "machineModel")[];
  /** Typed fields this request may carry; selects list their allowed values. */
  fields: Partial<Record<SupportFieldKey, { label: string; options?: string[]; required?: boolean }>>;
}

export const MACHINE_MODELS = [
  "Goodstrong GMC-TC II 1650",
  "Goodstrong GMC-TC 1600-E",
  "Martin sheeter or rollstand",
  "JME vertical core splitter",
  "Other / not sure",
];

export const DOC_TYPES = [
  "Operator manual",
  "Parts list & diagram",
  "Electrical schematic",
  "Service manual",
  "All available documentation",
];

export const SERVICE_TYPES = [
  "Diagnostic / troubleshooting",
  "Repair or component replacement",
  "Refurbishment / rebuild",
  "Installation support",
];

export const SALES_TOPICS = [
  "Equipment purchase or quote",
  "Custom configuration",
  "Financing or leasing",
  "Partnership or reseller inquiry",
  "Other",
];

export const SUPPORT_SPECS: Record<SupportType, SupportTypeSpec> = {
  "manual-request": {
    label: "Manual / documentation request",
    flag: "MANUAL",
    required: ["email", "serial"],
    fields: {
      machineModel: { label: "Machine model", options: MACHINE_MODELS, required: true },
      docType: { label: "Documentation requested", options: DOC_TYPES },
    },
  },
  "service-request": {
    label: "Field service request",
    flag: "SERVICE",
    required: ["name", "phone", "message"],
    fields: {
      serviceType: { label: "Service type", options: SERVICE_TYPES },
    },
  },
  "fitment-check": {
    label: "Fitment confirmation request",
    flag: "FITMENT",
    required: ["email"],
    requireAnyOf: ["serial", "machineModel"],
    fields: {
      partNumber: { label: "Part / SKU", required: true },
      machineModel: { label: "Machine serial or model" },
    },
  },
  "epc-lookup": {
    label: "Parts diagram (EPC) lookup",
    flag: "EPC",
    required: ["email", "serial"],
    fields: {},
  },
  "sales-inquiry": {
    label: "Sales inquiry",
    flag: "SALES",
    required: ["name", "email"],
    fields: {
      topic: { label: "Topic", options: SALES_TOPICS, required: true },
    },
  },
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SupportContactInput {
  name?: unknown;
  company?: unknown;
  email?: unknown;
  phone?: unknown;
  serial?: unknown;
  message?: unknown;
  consent?: unknown;
  website?: unknown; // honeypot
}

export type SupportOutcome =
  | { kind: "honeypot" }
  | { kind: "invalid" }
  | { kind: "ok"; fields: Partial<Record<SupportFieldKey, string>> };

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * Decide how to handle a typed support submission and, when it passes,
 * return the typed fields resolved against our own option lists. A select
 * value that is not on the list is a validation failure, never passed on.
 */
export function evaluateSupportRequest(
  type: SupportType,
  contact: SupportContactInput,
  rawFields: unknown,
): SupportOutcome {
  if (str(contact.website, 10).length > 0) return { kind: "honeypot" };
  const spec = SUPPORT_SPECS[type];
  const f = rawFields && typeof rawFields === "object" ? (rawFields as Record<string, unknown>) : {};

  const name = str(contact.name, 200);
  const email = str(contact.email, 320);
  const phone = str(contact.phone, 40);
  const serial = str(contact.serial, 80);
  const message = str(contact.message, 4000);
  const consent = contact.consent === true;

  const fields: Partial<Record<SupportFieldKey, string>> = {};
  for (const [key, def] of Object.entries(spec.fields) as [SupportFieldKey, NonNullable<SupportTypeSpec["fields"][SupportFieldKey]>][]) {
    const v = str(f[key], 200);
    if (!v) {
      if (def.required) return { kind: "invalid" };
      continue;
    }
    if (def.options && !def.options.includes(v)) return { kind: "invalid" };
    fields[key] = v;
  }

  const present: Record<string, boolean> = {
    name: name.length > 0,
    email: email.length > 0,
    phone: phone.length > 0,
    serial: serial.length > 0,
    message: message.length > 0,
    machineModel: !!fields.machineModel,
  };
  if (!spec.required.every((k) => present[k])) return { kind: "invalid" };
  if (spec.requireAnyOf && !spec.requireAnyOf.some((k) => present[k])) return { kind: "invalid" };
  if (email && !EMAIL_RE.test(email)) return { kind: "invalid" };
  // Every request needs a way to reply.
  if (!email && !phone) return { kind: "invalid" };
  if (!consent) return { kind: "invalid" };

  return { kind: "ok", fields };
}

/** Field labels in a fixed order, for the desk email and the CSV. */
export function supportDetailLines(type: SupportType, fields: Partial<Record<SupportFieldKey, string>>): string[] {
  const spec = SUPPORT_SPECS[type];
  const out: string[] = [];
  for (const [key, def] of Object.entries(spec.fields) as [SupportFieldKey, { label: string }][]) {
    const v = fields[key];
    if (v) out.push(`${def.label}: ${v}`);
  }
  return out;
}
