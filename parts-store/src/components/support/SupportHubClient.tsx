"use client";

import "@/styles/support.css";
import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Button, Eyebrow, Field, Toast } from "@/components/ui";
import { SiteNav } from "@/components/SiteNav";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { useUrlParam } from "@/hooks/useUrlParam";
import { SUPPORT_FORMS, fieldErrors, type SupportForm, type SupportKind } from "@/lib/supportRequest";
import { matchSerialToModel } from "@/data/goodstrong";

const PHONE = "(269) 659-0093";
const TEL = "tel:+12696590093";
const EMAIL = "parts@jmequipment.net";

type Panel = "guides" | SupportKind;

/** `?panel=` values — the design's short names — to the panel they open. */
const PANEL_BY_PARAM: Record<string, Panel> = {
  guides: "guides",
  manual: "manual-request",
  service: "service-request",
  fitment: "fitment-check",
  epc: "epc-lookup",
  contact: "sales-inquiry",
};
const PARAM_BY_PANEL = Object.fromEntries(Object.entries(PANEL_BY_PARAM).map(([k, v]) => [v, k])) as Record<Panel, string>;

const PATHS: { panel: Panel; eyebrow: string; title: string; blurb: string; cta: string }[] = [
  {
    panel: "guides",
    eyebrow: "Self-serve",
    title: "Troubleshooting",
    blurb: "Common issues, maintenance schedules, and first-aid steps for Goodstrong, Martin, and JME equipment.",
    cta: "Browse guides",
  },
  {
    panel: "manual-request",
    eyebrow: "Documents",
    title: "Manuals & documentation",
    blurb: "OEM manuals, parts lists, assembly drawings, and electrical schematics. Request by machine serial or model.",
    cta: "Request manual",
  },
  {
    panel: "service-request",
    eyebrow: "Field service",
    title: "Service & repairs",
    blurb: "Field service, on-site diagnostics, component refurbishment, and emergency support. Call or submit a request.",
    cta: "Request service",
  },
  {
    panel: "fitment-check",
    eyebrow: "Verification",
    title: "Fitment confirmation",
    blurb: "Unsure if a part fits your machine? Provide the serial number and model; we'll verify compatibility.",
    cta: "Confirm fitment",
  },
  {
    panel: "epc-lookup",
    eyebrow: "Diagrams",
    title: "Parts diagrams (EPC)",
    blurb: "Balloon references and exploded views, tied to a machine serial. Enter your serial to see what we hold.",
    cta: "Check a serial",
  },
  {
    panel: "sales-inquiry",
    eyebrow: "Sales",
    title: "Contact sales",
    blurb: "Equipment purchases, custom configurations, financing, and partnership inquiries.",
    cta: "Message sales",
  },
];

const GUIDES = [
  {
    title: "Goodstrong 1650 hydraulic noise",
    body: "If you hear elevated pump noise during idle, check reservoir oil level and coolant saturation. Most cases resolve with a 100-micron filter change.",
  },
  {
    title: "Martin rollstand bearing wear",
    body: "Spindle roughness under load may indicate bearing preload drift. Contact JME service for inspection and replacement kit.",
  },
];

const KNOWN_ISSUES = [
  ...GUIDES,
  {
    title: "SN 26218 EPC — diagram linkage pending",
    body: "Diagram linkage is pending receipt of current documentation from the publisher. Request a manual or a specific parts list in the meantime, or call the desk and describe the assembly.",
  },
];

/**
 * Support Hub — transcribed from the design reference of the same name.
 * Six paths, one desk: each form reaches the same inbox as a quote request,
 * gets a reference on screen and a written reply from a person. Deep links
 * (`?panel=manual`) open a panel directly, for email signatures and the
 * assistant.
 */
export function SupportHubClient() {
  const { count } = useRequestList();
  const { message, show } = useToast(3200);
  // The URL opens a panel on arrival; a click overrides it for this visit.
  // Derived, not synced in an effect, so server and first client render agree.
  const fromUrl = useUrlParam("panel");
  // A machine page hands the part and machine over in the URL so the fitment
  // form opens already filled in.
  const seedSku = useUrlParam("sku");
  const seedMachine = useUrlParam("machine");
  const [picked, setPicked] = useState<Panel | null | undefined>(undefined);
  const open: Panel | null = picked === undefined ? (fromUrl ? (PANEL_BY_PARAM[fromUrl] ?? null) : null) : picked;

  const choose = (p: Panel | null) => {
    setPicked(p);
    const url = new URL(window.location.href);
    if (p) url.searchParams.set("panel", PARAM_BY_PANEL[p]);
    else url.searchParams.delete("panel");
    window.history.replaceState(null, "", url);
    if (p) requestAnimationFrame(() => document.getElementById("support-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <SiteNav
        count={count}
        links={[
          { label: "Catalog", href: "/#parts" },
          { label: "Machine Platform", href: "/machines" },
          { label: "Manuals", href: "/parts/goodstrong" },
          { label: "Support", href: "/support", current: true },
          { label: "Compare", href: "/compare" },
        ]}
      />

      <main id="main" className="sh">
        <header className="sh__head">
          <Eyebrow tone="gold">Sturgis, Michigan</Eyebrow>
          <h1 className="jme-h2 sh__title">Support &amp; Resources</h1>
          <p className="sh__lead">
            Troubleshooting, manuals, service requests, and direct access to our technical team. Every form here
            reaches the same parts desk in Sturgis &mdash; you&rsquo;ll get a reference number on screen and a
            reply from a person.
          </p>
        </header>

        <section className="sh__strip" aria-label="Reach the desk">
          <div className="sh__tile">
            <span className="sh__tile-k">Sales &amp; support</span>
            <a className="sh__tile-v jme-mono" href={TEL}>
              {PHONE}
            </a>
            <span className="sh__tile-n">9am&ndash;5pm EST, Mon&ndash;Fri</span>
          </div>
          <div className="sh__tile">
            <span className="sh__tile-k">Parts desk</span>
            <a className="sh__tile-v jme-mono" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
            <span className="sh__tile-n">Replies in writing, typically the same business day</span>
          </div>
          <div className="sh__tile">
            <span className="sh__tile-k">Service requests</span>
            <button type="button" className="sh__tile-v sh__tile-btn" onClick={() => choose("service-request")}>
              Submit request
            </button>
            <span className="sh__tile-n">Field service, repairs</span>
          </div>
        </section>

        <section className="sh__paths-wrap" aria-labelledby="sh-paths">
          <div className="sh__sec-hd">
            <Eyebrow>Get help</Eyebrow>
            <h2 id="sh-paths" className="jme-h2 sh__h2">
              Six paths, all answered from one floor
            </h2>
          </div>
          <div className="sh__paths">
            {PATHS.map((p) => (
              <button
                key={p.panel}
                type="button"
                className={"sh__path" + (open === p.panel ? " on" : "")}
                aria-pressed={open === p.panel}
                onClick={() => choose(p.panel)}
              >
                <span className="sh__path-eb">{p.eyebrow}</span>
                <span className="sh__path-t">{p.title}</span>
                <span className="sh__path-b">{p.blurb}</span>
                <span className="sh__path-cta">{p.cta} &rarr;</span>
              </button>
            ))}
          </div>
        </section>

        {open && (
          <section id="support-panel" className="sh__panel" aria-labelledby="sh-panel-title">
            <div className="sh__panel-hd">
              <div>
                <Eyebrow tone="gold">{open === "guides" ? "Self-serve" : SUPPORT_FORMS[open].eyebrow}</Eyebrow>
                <h2 id="sh-panel-title" className="jme-h2 sh__h2">
                  {open === "guides" ? "Troubleshooting" : SUPPORT_FORMS[open].title}
                </h2>
              </div>
              <button type="button" className="sh__close" aria-label="Close this panel" onClick={() => choose(null)}>
                &#x2715;
              </button>
            </div>
            {open === "guides" ? (
              <Guides onService={() => choose("service-request")} />
            ) : (
              <SupportRequestForm
                key={open}
                form={SUPPORT_FORMS[open]}
                onNotice={show}
                seed={open === "fitment-check" ? { sku: seedSku ?? "", machine: seedMachine ?? "" } : undefined}
              />
            )}
          </section>
        )}

        <section className="sh__issues-wrap" aria-labelledby="sh-issues">
          <div className="sh__sec-hd">
            <Eyebrow>Known issues</Eyebrow>
            <h2 id="sh-issues" className="jme-h2 sh__h2">
              What the desk is currently fielding
            </h2>
          </div>
          <div className="sh__issues">
            {KNOWN_ISSUES.map((k) => (
              <article key={k.title} className="sh__issue">
                <h3 className="sh__issue-t">{k.title}</h3>
                <p>{k.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sh__band">
          <div>
            <h2 className="jme-h2 sh__h2">Send us what you have</h2>
            <p>
              A photo of the dataplate, a manual page, or the old part in your hand is enough to start. We&rsquo;d
              rather confirm fitment from your serial number than guess from a description &mdash; that&rsquo;s how
              the wrong part gets shipped.
            </p>
          </div>
          <Button as="a" href="/#request">
            Open your request list
          </Button>
        </section>

        <address className="sh__addr">
          <span className="sh__tile-k">One floor in Sturgis</span>
          <span>405 1/2 W Congress St</span>
          <span>Sturgis, MI 49091</span>
          <span className="sh__tile-n">FOB Sturgis, MI</span>
        </address>
      </main>

      {message && <Toast tone="green">{message}</Toast>}
    </>
  );
}

function Guides({ onService }: { onService: () => void }) {
  return (
    <div className="sh__guides">
      <p className="sh__lead">
        Start here for the issues we field most often. If your symptom is not listed, the desk would rather hear it
        described than have you guess.
      </p>
      {GUIDES.map((g) => (
        <article key={g.title} className="sh__issue">
          <h3 className="sh__issue-t">{g.title}</h3>
          <p>{g.body}</p>
        </article>
      ))}
      <p className="sh__fine">
        These are the write-ups we&rsquo;ve published so far. For anything else, describe the symptom to the desk
        &mdash; 37 years of service notes aren&rsquo;t all online, and the fastest route is usually a phone call.
      </p>
      <div className="ps-actions">
        <Button onClick={onService}>Request service</Button>
        <Button as="a" variant="ghost" href={TEL}>
          Call the desk
        </Button>
      </div>
    </div>
  );
}

const CONTACT_PHONE_NOTE = `Could not send — check your connection, or call ${PHONE}`;

function SupportRequestForm({
  form,
  onNotice,
  seed,
}: {
  form: SupportForm;
  onNotice: (m: string) => void;
  /** Values to start the form with (from the URL); capped like any other input. */
  seed?: Record<string, string>;
}) {
  const blank = () =>
    Object.fromEntries(form.fields.map((f) => [f.key, (seed?.[f.key] ?? "").slice(0, 200)])) as Record<string, string>;
  const [values, setValues] = useState<Record<string, string>>(blank);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ ref: string | null; echo: Record<string, string>; held: { label: string; href: string } | null } | null>(null);

  const set = (key: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit() {
    const e = fieldErrors(form, values);
    if (!consent) e.consent = "Required to submit.";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      onNotice("Check the highlighted fields");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: form.kind, fields: values, consent, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // A serial the published manuals already cover gets its link on the
        // spot; the desk still confirms in writing.
        const model = (form.kind === "epc-lookup" || form.kind === "manual-request") && values.serial ? matchSerialToModel(values.serial) : undefined;
        setDone({
          ref: typeof data.ref === "string" ? data.ref : null,
          echo: { ...values },
          held: model ? { label: model.label, href: `/parts/goodstrong/${model.id}` } : null,
        });
        onNotice("Request logged — the desk replies in writing");
      } else if (res.status >= 500) {
        onNotice(data.error || `Our system is having trouble — please call ${PHONE}`);
      } else {
        onNotice(data.error || "Check the form and try again");
      }
    } catch {
      onNotice(CONTACT_PHONE_NOTE);
    }
    setSending(false);
  }

  if (done) {
    return (
      <div className="ps-sent sh__sent" role="status">
        <b>Request logged.</b>
        <span>
          {done.ref ? (
            <>
              Your reference is <span className="jme-mono">{done.ref}</span> &mdash; write it down.{" "}
            </>
          ) : null}
          The parts desk replies in writing, typically within one business day. This is not scheduled work or a firm
          quotation until we confirm it in writing.
        </span>
        {done.held && (
          <p className="sh__held">
            The published {done.held.label} Part Catalogue is online now &mdash; its sections and parts pages are{" "}
            <Link href={done.held.href}>here</Link>. The desk still confirms it against your serial in writing.
          </p>
        )}
        <dl className="jme-plate jme-plate__rows sh__echo">
          {form.fields
            .filter((f) => done.echo[f.key])
            .map((f) => (
              <div key={f.key} className="jme-plate__row">
                <dt>{f.label}</dt>
                <dd>{done.echo[f.key]}</dd>
              </div>
            ))}
        </dl>
        <div className="ps-actions">
          <Button as="a" variant="ghost" href={TEL}>
            Call {PHONE}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDone(null);
              setValues(blank());
              setConsent(false);
              setErrors({});
            }}
          >
            Send another
          </Button>
          <Button as="a" href="/#request">
            Open your request list
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="sh__form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="sh__lead">{form.lead}</p>
      <div className="sh__grid">
        {form.fields.map((f) => {
          const id = `sf-${form.kind}-${f.key}`;
          const label = f.required ? `${f.label} *` : f.label;
          const common = { id, label, hint: f.hint, error: errors[f.key], required: f.required, value: values[f.key] ?? "" };
          if (f.type === "select") {
            return (
              <Field
                key={f.key}
                as="select"
                {...common}
                onChange={set(f.key)}
                options={[{ value: "", label: f.placeholder ?? "Select" }, ...(f.options ?? []).map((o) => ({ value: o, label: o }))]}
              />
            );
          }
          if (f.type === "textarea") {
            return <Field key={f.key} as="textarea" className="sh__wide" {...common} rows={4} placeholder={f.placeholder} onChange={set(f.key)} />;
          }
          return (
            <Field
              key={f.key}
              {...common}
              type={f.type}
              placeholder={f.placeholder}
              autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.to === "name" ? "name" : f.to === "company" ? "organization" : "off"}
              onChange={set(f.key)}
            />
          );
        })}
      </div>

      <label className="ps-check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>
          I agree to the{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>{" "}
          and consent to being contacted about this request.
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
        <label htmlFor={`sf-${form.kind}-website`}>Website</label>
        <input id={`sf-${form.kind}-website`} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div className="ps-actions sh__actions">
        <Button type="submit" disabled={sending}>
          {form.submit}
        </Button>
        <span className="sh__or">
          Or call <a href={TEL}>{PHONE}</a>
        </span>
        {form.aside && (
          <Link className="sh__aside" href={form.aside.href}>
            {form.aside.label} &rarr;
          </Link>
        )}
      </div>
      <p className="sh__fine">{form.fine}</p>
    </form>
  );
}
