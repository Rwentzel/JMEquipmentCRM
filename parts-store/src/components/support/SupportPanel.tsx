"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field } from "@/components/ui";
import {
  DOC_TYPES,
  MACHINE_MODELS,
  SALES_TOPICS,
  SERVICE_TYPES,
  SUPPORT_SPECS,
  evaluateSupportRequest,
  type SupportFieldKey,
  type SupportType,
} from "@/lib/supportRequests";
import { DESK_EMAIL, DESK_PHONE_DISPLAY, telHref } from "@/lib/requestRoutes";
import { KNOWN_ISSUES, PANELS, PENDING_EPC_SERIALS, type PanelKey } from "./panels";

type Values = Record<string, string>;

const CONTACT_KEYS = ["name", "company", "email", "phone", "serial", "message"] as const;
const FIELD_KEYS: SupportFieldKey[] = ["machineModel", "docType", "serviceType", "partNumber", "topic"];

interface FieldDef {
  key: (typeof CONTACT_KEYS)[number] | SupportFieldKey;
  label: string;
  hint?: string;
  placeholder?: string;
  as?: "textarea" | "select";
  options?: string[];
  type?: string;
  required?: boolean;
  autoComplete?: string;
}

/** Form layout per panel — the design references' field order and labels. */
const FORMS: Partial<Record<PanelKey, FieldDef[]>> = {
  manual: [
    { key: "serial", label: "Machine serial number", hint: "the dataplate photo works fine if the number is hard to read", placeholder: "e.g. SN-26218 or GS-1650-B-2019", required: true },
    { key: "machineModel", label: "Machine model", as: "select", options: MACHINE_MODELS, required: true },
    { key: "docType", label: "What documentation do you need?", as: "select", options: DOC_TYPES },
    { key: "email", label: "Email address", type: "email", placeholder: "you@company.com", required: true, autoComplete: "email" },
  ],
  service: [
    { key: "name", label: "Your name", required: true, autoComplete: "name" },
    { key: "company", label: "Company", autoComplete: "organization" },
    { key: "phone", label: "Phone", hint: "best number to reach the person standing at the machine", type: "tel", required: true, autoComplete: "tel" },
    { key: "serial", label: "Machine serial number", placeholder: "e.g. SN-26218" },
    { key: "message", label: "Describe the issue", as: "textarea", placeholder: "Symptoms, error codes, when it started, parts that have been replaced", required: true },
    { key: "serviceType", label: "Service type", as: "select", options: SERVICE_TYPES },
  ],
  fitment: [
    { key: "partNumber", label: "Part SKU", placeholder: "e.g. JME-GMC-BLD-001", required: true },
    { key: "machineModel", label: "Machine serial or model", placeholder: "e.g. SN-26218 or Goodstrong 1650", required: true },
    { key: "message", label: "Additional context", as: "textarea", placeholder: "Assembly location, replacement scenario, any other detail" },
    { key: "email", label: "Contact email", type: "email", required: true, autoComplete: "email" },
  ],
  epc: [
    { key: "serial", label: "Machine serial number", placeholder: "e.g. SN-26218", required: true },
    { key: "email", label: "Email address", type: "email", placeholder: "you@company.com", required: true, autoComplete: "email" },
  ],
  contact: [
    { key: "name", label: "Your name", required: true, autoComplete: "name" },
    { key: "company", label: "Company", autoComplete: "organization" },
    { key: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
    { key: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
    { key: "topic", label: "What can we help with?", as: "select", options: SALES_TOPICS, required: true },
    { key: "message", label: "Message", as: "textarea", placeholder: "Tell us about your line and what it needs to do..." },
  ],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function localErrors(defs: FieldDef[], v: Values, consent: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  for (const d of defs) {
    if (d.required && !(v[d.key] ?? "").trim()) e[d.key] = "Required.";
  }
  if ((v.email ?? "").trim() && !EMAIL_RE.test(v.email!.trim())) e.email = "Enter a valid email.";
  if (!consent) e.consent = "Required to submit.";
  return e;
}

/** The customer's own mail-client draft for the "Email it" route. */
function supportMailto(title: string, ref: string | null, rows: [string, string][]): string {
  const subject = ref ? `[${ref}] ${title}` : title;
  const body = [ref ? `Reference: ${ref}` : `Request: ${title}`, "", ...rows.map(([k, val]) => `${k}: ${val}`), "", "Please confirm in writing."].join("\n");
  return `mailto:${DESK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SupportPanel({
  panelKey,
  onClose,
  onSwitch,
}: {
  panelKey: PanelKey;
  onClose: () => void;
  onSwitch: (key: PanelKey) => void;
}) {
  const def = PANELS.find((p) => p.key === panelKey)!;
  const defs = FORMS[panelKey] ?? [];
  const [values, setValues] = useState<Values>({});
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = `sp-title-${panelKey}`;

  // Esc closes; focus lands inside the dialog on open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const first = boxRef.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.sp__close)");
    (first ?? boxRef.current)?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, panelKey]);

  const set = (k: string) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => {
      if (!er[k]) return er;
      const next = { ...er };
      delete next[k];
      return next;
    });
  };

  const rows = (): [string, string][] =>
    defs.filter((d) => (values[d.key] ?? "").trim()).map((d) => [d.label, values[d.key]!.trim()]);

  function reset() {
    setValues({});
    setConsent(false);
    setErrors({});
    setFailed(null);
    setRef(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!def.type) return;
    const errs = localErrors(defs, values, consent);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const contact: Record<string, unknown> = { consent, website };
    for (const k of CONTACT_KEYS) if (values[k]) contact[k] = values[k];
    const fields: Record<string, string> = {};
    for (const k of FIELD_KEYS) if (values[k]) fields[k] = values[k]!;
    // Same rules as the server, before the round trip.
    if (evaluateSupportRequest(def.type as SupportType, contact, fields).kind === "invalid") {
      setErrors({ form: "Check the highlighted fields." });
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: def.type, contact, fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.ref === "string") {
        setRef(data.ref);
      } else if (res.status >= 500) {
        setFailed(data.error || `Our system is having trouble — nothing was sent from this screen.`);
      } else {
        setErrors({ form: data.error || "Check the form and try again." });
      }
    } catch {
      setFailed("Could not reach the desk — check your connection. Nothing was sent from this screen.");
    } finally {
      setBusy(false);
    }
  }

  const pendingSerial =
    panelKey === "epc" && PENDING_EPC_SERIALS.some((s) => (values.serial ?? "").replace(/\D/g, "").includes(s));

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div
        className="sp"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sp__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <span className="sp__kicker">{def.kicker}</span>
        <h2 id={titleId} className="sp__title">
          {def.title}
        </h2>

        {panelKey === "guides" && (
          <div className="sp__body">
            <p className="sp__intro">{def.intro}</p>
            {KNOWN_ISSUES.filter((k) => !k.pending).map((k) => (
              <article className="sp-guide" key={k.title}>
                <h3>{k.title}</h3>
                <p>{k.body}</p>
              </article>
            ))}
            <p className="sp__note">
              These are the write-ups we&rsquo;ve published so far. For anything else, describe the symptom to the desk
              — 37 years of service notes aren&rsquo;t all online, and the fastest route is usually a phone call.
            </p>
            <div className="sp__actions">
              <Button onClick={() => onSwitch("service")}>Request service</Button>
              <Button variant="ghost" as="a" href={telHref()}>
                Call the desk
              </Button>
            </div>
          </div>
        )}

        {panelKey !== "guides" && ref && (
          <div className="sp__body" role="status">
            <span className="sp__logged">Request logged</span>
            <span className="sp__reflbl">Your reference</span>
            <span className="sp__ref jme-mono">{ref}</span>
            <dl className="sp-summary">
              {rows().map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div>
                <dt>Tagged source</dt>
                <dd className="jme-mono">{def.type}</dd>
              </div>
            </dl>
            <span className="sp__reflbl">Other ways to get this to us</span>
            <div className="sp-routes">
              <a className="sp-route" href={supportMailto(def.title, ref, rows())}>
                <b>Email it</b>
                <span>{DESK_EMAIL}</span>
              </a>
              <a className="sp-route" href={telHref()}>
                <b>Call it in</b>
                <span>{DESK_PHONE_DISPLAY}</span>
              </a>
              <button type="button" className="sp-route" onClick={() => window.print()}>
                <b>Print it</b>
                <span>Fax or hand-carry</span>
              </button>
            </div>
            <p className="sp__note">
              Write the reference number down. The desk has this request and a person replies within one business day.
              Requests are not scheduled work or firm quotations until we confirm in writing.
            </p>
            <div className="sp__actions">
              <Button onClick={onClose}>Done</Button>
              <Button variant="ghost" onClick={reset}>
                Send another
              </Button>
            </div>
          </div>
        )}

        {panelKey !== "guides" && !ref && (
          <form className="sp__body" onSubmit={submit} noValidate>
            <p className="sp__intro">{def.intro}</p>
            {defs.map((d) =>
              d.as === "select" ? (
                <Field
                  key={d.key}
                  as="select"
                  id={`sp-${panelKey}-${d.key}`}
                  label={d.label + (d.required ? " *" : "")}
                  value={values[d.key] ?? ""}
                  onChange={set(d.key)}
                  error={errors[d.key]}
                  required={d.required}
                  options={[{ value: "", label: "Select" }, ...(d.options ?? []).map((o) => ({ value: o, label: o }))]}
                />
              ) : d.as === "textarea" ? (
                <Field
                  key={d.key}
                  as="textarea"
                  id={`sp-${panelKey}-${d.key}`}
                  label={d.label + (d.required ? " *" : "")}
                  placeholder={d.placeholder}
                  value={values[d.key] ?? ""}
                  onChange={set(d.key)}
                  error={errors[d.key]}
                  required={d.required}
                  rows={4}
                />
              ) : (
                <Field
                  key={d.key}
                  id={`sp-${panelKey}-${d.key}`}
                  label={d.label + (d.required ? " *" : "")}
                  hint={d.hint}
                  type={d.type ?? "text"}
                  placeholder={d.placeholder}
                  value={values[d.key] ?? ""}
                  onChange={set(d.key)}
                  error={errors[d.key]}
                  required={d.required}
                  autoComplete={d.autoComplete}
                />
              ),
            )}

            {panelKey === "epc" && (
              <>
                <Link className="sp__link" href="/parts/goodstrong">
                  Browse the published Goodstrong pages meanwhile
                </Link>
                <div aria-live="polite">
                  {pendingSerial && (
                    <p className="sp__pending">
                      <b>Diagram linkage pending for this serial.</b> Current documentation is on its way from the
                      publisher. Send this anyway and the desk works from the parts list, or request a manual meanwhile.
                    </p>
                  )}
                </div>
              </>
            )}

            <label className="ps-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer">
                  Terms of Sale
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
                , and consent to being contacted about this request.
                {errors.consent && (
                  <span className="ps-field-err" role="alert">
                    {" "}
                    {errors.consent}
                  </span>
                )}
              </span>
            </label>

            {/* Honeypot: visually hidden, must remain empty */}
            <div aria-hidden className="ps-honeypot">
              <label htmlFor={`sp-${panelKey}-website`}>Website</label>
              <input id={`sp-${panelKey}-website`} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {errors.form && (
              <p className="ps-field-err" role="alert">
                {errors.form}
              </p>
            )}

            {failed && (
              <div className="ps-sent ps-sent--warn" role="alert">
                <b>We couldn&rsquo;t log this.</b>
                <span>{failed} Your entries are kept — email it, call it in, or try again in a moment.</span>
                <div className="ps-routes__links">
                  <a className="ps-routes__link" href={supportMailto(def.title, null, rows())}>
                    Email it
                  </a>
                  <a className="ps-routes__link" href={telHref()}>
                    Call {DESK_PHONE_DISPLAY}
                  </a>
                </div>
              </div>
            )}

            <div className="sp__actions">
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : def.submit}
              </Button>
              <span className="sp__or">
                Or call <a href={telHref()}>{DESK_PHONE_DISPLAY}</a>
              </span>
            </div>
            <p className="sp__note">{def.note}</p>
            <p className="sp__note">
              Reaches the parts desk directly — you&rsquo;ll get a reference on screen. Not a scheduled visit or a
              firm quotation until we confirm in writing.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/** Exported for tests: the labels the desk sees must match the panel copy. */
export const PANEL_TYPE_LABELS = Object.fromEntries(
  PANELS.filter((p) => p.type).map((p) => [p.key, SUPPORT_SPECS[p.type as SupportType].label]),
);
