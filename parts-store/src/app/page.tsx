"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  DataPlate,
  Diamond,
  Eyebrow,
  Field,
  SmartImg,
  StatBlock,
  StatusBand,
  Tag,
  Toast,
} from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { useReveal } from "@/hooks/useReveal";
import { useDebounce } from "@/hooks/useDebounce";
import { catalog } from "@/data/catalog";
import { toPublicMachine, toPublicPart } from "@/data/sanitize";
import type { Machine, Part } from "@/data/types";
import { asset, actionLabel } from "@/lib/utils";

const D = {
  contact: catalog.contact,
  machines: catalog.machines.map(toPublicMachine),
  parts: catalog.parts.map(toPublicPart),
  cats: catalog.cats,
};

/* ---------------------------------------------------------------- Photo --- */
function MachinePhoto({ m }: { m: Machine }) {
  if (m.photo) {
    return <SmartImg src={asset(m.photo)} alt={m.name} />;
  }
  return (
    <div className="ps-machine__ph">
      <Diamond size={44} />
      <span className="ps-machine__ph-fam">{m.family ?? "JM Equipment"}</span>
      <span className="ps-machine__ph-note">Photo on request</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Nav --- */
function Nav({ count, onJump }: { count: number; onJump: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const links = ["Machines", "Parts", "Request", "Why JME"];
  const go = (id: string) => {
    setOpen(false);
    onJump(id);
  };
  return (
    <nav className="ps-nav">
      <div className="ps-nav__in">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); go("top"); }}>
          <Diamond size={30} />
          <span>
            <b>JM Equipment</b>
            <small>Converting Machinery Solutions</small>
          </span>
        </a>
        <div className={"ps-nav__links" + (open ? " open" : "")}>
          {links.map((l) => {
            const id = l.toLowerCase().replace(/[^a-z]/g, "");
            return (
              <a key={l} href={`#${id}`} onClick={(e) => { e.preventDefault(); go(id); }}>
                {l}
              </a>
            );
          })}
          <a href="/compare">Compare</a>
        </div>
        <Button size="sm" onClick={() => go("request")}>
          Request List{count > 0 ? ` · ${count}` : ""}
        </Button>
        <button
          className="ps-nav__burger"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "≡"}
        </button>
      </div>
    </nav>
  );
}

/* ----------------------------------------------------------------- Hero --- */
function Hero({ onJump, statsOn }: { onJump: (id: string) => void; statsOn: boolean }) {
  return (
    <header className="ps-hero" id="top">
      <div className="ps-hero__grid">
        <div className="ps-hero__copy">
          <Eyebrow>Converting Machinery Solutions · Est. 1989</Eyebrow>
          <h1 className="ps-hero__h1">
            3<em>×</em> the cores.
            <br />
            Same pallet.
          </h1>
          <p className="ps-hero__lead">
            Sheeters, rollstands, and the JME core splitter — built, rebuilt, and parts-supported under one roof in{" "}
            {D.contact.city} since {D.contact.est}.
          </p>
          <div className="ps-hero__cta">
            <Button size="lg" onClick={() => onJump("machines")}>
              Browse Machines
            </Button>
            <Button size="lg" variant="ghost" onClick={() => onJump("parts")}>
              Order Parts
            </Button>
          </div>
          <ul className="ps-hero__creds" aria-label="Credentials">
            <li>Sturgis, MI</li>
            <li>Since 1989</li>
            <li>Build · Rebuild · Parts</li>
            <li>OEM+ rebuild spec</li>
          </ul>
          {statsOn && (
            <div className="ps-hero__stats">
              <StatBlock
                stats={[
                  { value: "37 yrs", label: "In converting" },
                  { html: "98<em>%</em>", label: "Same-day parts" },
                  { value: "OEM+", label: "Rebuild spec" },
                ]}
              />
            </div>
          )}
        </div>
        <div className="ps-hero__photo">
          <SmartImg src={asset("core-splitter.png")} alt="JME Hydraulic Core Splitter" />
          <span className="ps-hero__cap">JME Core Splitter · Sturgis, MI</span>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------- Machines --- */
function Machines({ onAdd }: { onAdd: (it: { sku: string; name: string }) => void }) {
  return (
    <section id="machines" className="ps-sec">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Equipment</Eyebrow>
            <h2 className="jme-h2">Machines</h2>
          </div>
          <p>
            Factory-direct sheeters, rebuilt rollstands, and the hydraulic core splitter. Every machine is quoted
            individually — add to your request to start.
            <a className="ps-comparelink" href="/compare">
              Compare the full line →
            </a>
          </p>
        </div>
        <div className="ps-machines">
          {D.machines.map((m) => (
            <div className="ps-machine" key={m.sku}>
              <div className={"ps-machine__photo" + (m.fit === "contain" ? " is-contain" : "")}>
                <MachinePhoto m={m} />
                <Tag tone={m.tag} className="ps-machine__tag">
                  {m.tagLabel}
                </Tag>
              </div>
              <div className="ps-machine__body">
                <DataPlate title={m.name} sku={m.sku} rows={m.specs} />
                <p className="ps-machine__blurb">{m.blurb}</p>
                <div className="ps-machine__foot">
                  <StatusBand band={m.statusBand} />
                  <div className="ps-machine__acts">
                    <a className="ps-machine__link" href={`/machine/${m.sku}`}>
                      View machine →
                    </a>
                    <Button size="sm" onClick={() => onAdd({ sku: m.sku, name: m.name })}>
                      {actionLabel(m.action)}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Industries --- */
function Industries() {
  const inds: [string, string][] = [
    ["Paper & board mills", "Sheeting, roll handling, core reclaim"],
    ["Tissue & towel", "High-core-count lines, fast changeovers"],
    ["Folding carton", "Cut-size accuracy, flat stacks"],
    ["Film & flexible", "Web tension, zero-speed splicing"],
    ["Label & narrow web", "Slitting, rewinds, small cores"],
    ["Recycling / MRF", "Core densification, freight recovery"],
  ];
  return (
    <section id="industries" className="ps-sec">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Industries served</Eyebrow>
            <h2 className="jme-h2">Built for the converting floor</h2>
          </div>
          <p>
            Four decades supporting paper and board converters across the Midwest and beyond — new builds,
            factory-direct imports, and rebuilds on the machines you already run.
          </p>
        </div>
        <div className="ps-inds">
          {inds.map(([t, d]) => (
            <div className="ps-ind" key={t}>
              <span className="jme-diamond-bullet" />
              <b>{t}</b>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Capabilities --- */
function Capabilities() {
  const caps: [string, string][] = [
    ["Core splitters", "Hydraulic single-stroke splitting for OCC/kraft core reclaim."],
    ["Sheeters", "Factory-direct Goodstrong dual-rotary lines and rebuilds."],
    ["Rollstands", "Martin / Geo Martin rebuilds to OEM+ tolerance."],
    ["Guillotine cutters", "Programmable, two-hand + light-curtain safety."],
    ["Splicers & decurlers", "Zero-speed flying splice; inline curl removal."],
    ["Wear & service parts", "Blades, bearings, chucks, seals, valves, sensors."],
  ];
  return (
    <section id="capabilities" className="ps-sec">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow tone="gold">What we build & support</Eyebrow>
            <h2 className="jme-h2">Capabilities</h2>
          </div>
          <p>
            One floor in Sturgis covers the whole lifecycle — new builds, factory-direct imports, rebuilds, and the
            wear parts that keep a converting line running.
          </p>
        </div>
        <div className="ps-caps">
          {caps.map(([t, d], i) => (
            <div className="ps-cap" key={t}>
              <span className="ps-cap__n jme-mono">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Status legend --- */
const BANDS: [string, string][] = [
  ["In Stock", "stock"],
  ["Limited Stock", "lead"],
  ["Backorder", "lead"],
  ["Call for Availability", "info"],
  ["Quote Required", "default"],
  ["Freight Quote Required", "info"],
  ["Discontinued / Contact JM", "out"],
];
function StatusLegend() {
  return (
    <div className="ps-legend" aria-label="Availability key">
      <span className="ps-legend__lbl">Availability</span>
      {BANDS.map(([band, color]) => (
        <span
          key={band}
          className={
            "jme-badge" +
            (color === "stock" ? " jme-badge--stock" : "") +
            (color === "lead" ? " jme-badge--lead" : "") +
            (color === "info" ? " jme-badge--info" : "") +
            (color === "out" ? " jme-badge--out" : "")
          }
        >
          {band}
        </span>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Parts --- */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="ps-match">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function Parts({ onAdd }: { onAdd: (it: { sku: string; name: string }) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 200);
  const [cat, setCat] = useState("All");
  const results = useMemo<Part[]>(
    () =>
      D.parts.filter((p) => {
        const inCat = cat === "All" || p.cat === cat;
        const inQ = !dq || (p.sku + " " + p.name).toLowerCase().includes(dq.toLowerCase());
        return inCat && inQ;
      }),
    [dq, cat],
  );
  return (
    <section id="parts" className="ps-sec ps-sec--alt">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Parts desk</Eyebrow>
            <h2 className="jme-h2">Order parts</h2>
          </div>
          <p>
            98% of stocked parts ship same day from Sturgis. Search by number or description — pricing and lead time
            are confirmed in writing on your request.
          </p>
        </div>
        <div className="ps-search">
          <input
            className="jme-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search — e.g. JM108, blade, filter, valve"
            aria-label="Search parts"
          />
        </div>
        <div className="ps-chips" role="group" aria-label="Filter by category">
          {D.cats.map((c) => (
            <button
              key={c}
              className={"ps-chip" + (c === cat ? " on" : "")}
              aria-pressed={c === cat}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ps-parts-bar">
          <div className="ps-meta">
            {results.length} part{results.length !== 1 ? "s" : ""}
            {dq && <span className="ps-meta__q"> for &ldquo;{dq}&rdquo;</span>}
          </div>
          <StatusLegend />
        </div>
        <div className="ps-parts">
          {results.map((p) => (
            <div className="ps-part" key={p.sku}>
              <div className="ps-part__top">
                <span className="jme-mono ps-part__sku"><Highlight text={p.sku} q={dq} /></span>
                <StatusBand band={p.statusBand} />
              </div>
              <div className="ps-part__name"><Highlight text={p.name} q={dq} /></div>
              <Tag>{p.cat}</Tag>
              <div className="ps-part__foot">
                <Button size="sm" variant="ghost" block onClick={() => onAdd({ sku: p.sku, name: p.name })}>
                  {actionLabel(p.action)}
                </Button>
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <div className="ps-empty">
              No parts match &ldquo;{dq}&rdquo; — try a different term or{" "}
              <a href="#request" className="ps-link--gold">send a custom request</a>.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Services --- */
function Services() {
  const svc: [string, string][] = [
    ["Rebuild", "Disassemble, re-component, media-blast, repaint to your color, pressure-test to 150%."],
    ["Install & relocation", "Rigging, setup, alignment, and startup — on your floor, on your schedule."],
    ["Parts & support", "98% of stocked parts ship same day. Serial-based lookup and 24/7 phone support."],
    ["Consulting", "Line layout, throughput, and upgrade paths from engineers who build the machines."],
  ];
  return (
    <section className="ps-sec ps-sec--alt">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Beyond the machine</Eyebrow>
            <h2 className="jme-h2">Services</h2>
          </div>
        </div>
        <div className="ps-svcs">
          {svc.map(([t, d]) => (
            <div className="ps-svc" key={t}>
              <h4>{t}</h4>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Request --- */
interface ContactForm {
  company: string;
  name: string;
  email: string;
  phone: string;
  serial: string;
  /** Honeypot — must stay empty; bots fill it. */
  website: string;
}

function Request({
  items,
  contact,
  setContact,
  errors,
  onBlur,
  sent,
  reference,
  onQty,
  onRemove,
  onSend,
  onPrint,
}: {
  items: ReturnType<typeof useRequestList>["items"];
  contact: ContactForm;
  setContact: (c: ContactForm) => void;
  errors: Partial<Record<keyof ContactForm, string>>;
  onBlur: (k: keyof ContactForm) => () => void;
  sent: boolean;
  reference: string | null;
  onQty: (sku: string, qty: number) => void;
  onRemove: (sku: string) => void;
  onSend: () => void;
  onPrint: () => void;
}) {
  const set = (k: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setContact({ ...contact, [k]: e.target.value });

  return (
    <section id="request" className="ps-sec">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Request desk</Eyebrow>
            <h2 className="jme-h2">Your request list</h2>
          </div>
          <p>
            One list for machines and parts. Submitting requests a firm written quotation — not a binding order. The
            desk confirms price, stock, and lead time in writing.
          </p>
        </div>
        <div className="ps-reqgrid">
          <div className="jme-card ps-reqcard">
            <div className="jme-card__hd">
              <h3>Who should we answer?</h3>
              <span className="jme-mono ps-reqcard__badge">
                RFQ
              </span>
            </div>
            <div className="jme-card__body">
              <div className="ps-fgrid">
                <Field label="Company" placeholder="Your company" value={contact.company} onChange={set("company")} onBlur={onBlur("company")} required error={errors.company} />
                <Field label="Contact name" placeholder="Full name" value={contact.name} onChange={set("name")} onBlur={onBlur("name")} required error={errors.name} />
                <Field label="Email" type="email" placeholder="you@company.com" value={contact.email} onChange={set("email")} onBlur={onBlur("email")} required error={errors.email} />
                <Field label="Phone" placeholder="(000) 000-0000" value={contact.phone} onChange={set("phone")} />
              </div>
              <div className="ps-serial-wrap">
                <Field label="Machine serial number" hint="optional" placeholder="From the machine dataplate" value={contact.serial} onChange={set("serial")} />
              </div>
              {/* Honeypot: visually hidden, must remain empty */}
              <div aria-hidden className="ps-honeypot">
                <label htmlFor="ps-website">Website</label>
                <input id="ps-website" name="website" tabIndex={-1} autoComplete="off" value={contact.website} onChange={set("website")} />
              </div>
            </div>
          </div>
          <div className="jme-card ps-reqcard">
            <div className="jme-card__hd">
              <h3>Line items</h3>
              <span className="ps-linecount">{items.length} item(s)</span>
            </div>
            <div className="jme-card__body">
              {items.length === 0 && (
                <div className="ps-empty">
                  Your request list is empty. <a href="#machines" className="ps-link--gold">Browse machines</a> or{" "}
                  <a href="#parts" className="ps-link--gold">search parts</a> to add items.
                </div>
              )}
              {items.map((i) => (
                <div className="ps-line" key={i.sku}>
                  <div className="ps-line__main">
                    <span className="jme-mono ps-line__sku">{i.sku}</span>
                    <span className="ps-line__name">{i.name}</span>
                  </div>
                  <div className="ps-line__right">
                    <input
                      className="jme-input ps-qty"
                      type="number"
                      min={1}
                      value={i.qty}
                      aria-label={`Quantity for ${i.sku}`}
                      onChange={(e) => onQty(i.sku, Math.max(1, Number(e.target.value) || 1))}
                    />
                    <button className="ps-rm" onClick={() => onRemove(i.sku)} aria-label={`Remove ${i.sku}`}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {sent ? (
                <div className="ps-sent" role="status">
                  <b>Request sent.</b>
                  <span>
                    The parts desk replies in writing — typically the same business day.
                    {reference ? <> Reference <span className="jme-mono">{reference}</span>.</> : null}
                  </span>
                </div>
              ) : (
                <div className="ps-actions">
                  <Button onClick={onSend} disabled={items.length === 0}>
                    Send request
                  </Button>
                  <Button variant="ghost" onClick={onPrint}>
                    Print summary
                  </Button>
                </div>
              )}
              <p className="ps-fine">
                Quotations confirmed in writing before processing · No minimum order · FOB Sturgis, MI · Tax per ship-to
                jurisdiction on final invoice. Pricing and availability are provided by quotation, not shown online.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Trust --- */
function Trust() {
  const items = [
    { b: "37 years", s: "In converting", p: "Founded 1989. One floor in Sturgis — build, rebuild, and parts under the same roof." },
    { b: "98%", s: "Same-day parts", p: "Stocked parts ordered by early afternoon leave the dock the same day." },
    { b: "Factory-direct", s: "Goodstrong import", p: "New sheeters without the dealer stack — and a Michigan phone number behind them." },
    { b: "OEM+", s: "Rebuild tolerance", p: "Martin rebuilds held tighter than original, pressure-tested to 150% of operating." },
  ];
  return (
    <section id="whyjme" className="ps-sec ps-sec--alt">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Why converters call Sturgis</Eyebrow>
            <h2 className="jme-h2">Built here. Answered here.</h2>
          </div>
        </div>
        <div className="ps-trust">
          {items.map((t) => (
            <div className="ps-trust__cell" key={t.s}>
              <b>{t.b}</b>
              <span>{t.s}</span>
              <p>{t.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ --- */
function Faq() {
  const qa: [string, string][] = [
    [
      "Why don't I see prices online?",
      "Industrial parts and machines are quoted individually — pricing depends on configuration, freight, and lead time. Add what you need to a request and the desk confirms everything in writing.",
    ],
    [
      "How fast do parts ship?",
      "98% of stocked parts ordered by early afternoon leave the Sturgis dock the same day. Availability is shown as a status band; exact timing is confirmed on your quote.",
    ],
    [
      "Can you match a part from another OEM's machine?",
      "Often, yes. Send the machine serial number and a description or photo; we verify fit before quoting rather than guessing.",
    ],
    [
      "Do you handle freight on heavy items?",
      "Yes. Freight-heavy parts and machines are quoted with freight so there are no surprises — they're flagged \"Freight Quote Required.\"",
    ],
    [
      "Is a request a binding order?",
      "No. Submitting a request asks for a firm written quotation. Nothing is ordered or charged until you approve the quote.",
    ],
  ];
  return (
    <section id="faq" className="ps-sec">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Answers</Eyebrow>
            <h2 className="jme-h2">Common questions</h2>
          </div>
          <p>How the parts desk works — pricing, lead time, fit, and freight.</p>
        </div>
        <div className="ps-faq">
          {qa.map(([q, a]) => (
            <details className="ps-faq__item" key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Footer --- */
function Footer() {
  return (
    <footer className="ps-foot">
      <div className="jme-cutline" />
      <div className="ps-wrap ps-foot__grid">
        <div>
          <div className="brand ps-foot__brand">
            <Diamond size={30} />
            <span>
              <b className="ps-foot__name">JM Equipment</b>
              <small>Converting Machinery Solutions</small>
            </span>
          </div>
          <p>
            {D.contact.address}
            <br />
            Est. {D.contact.est} · Build · Rebuild · Parts
          </p>
        </div>
        <div>
          <h4>Parts Desk</h4>
          <a href={`tel:${D.contact.phone}`}>{D.contact.phone}</a>
          <a href={`mailto:${D.contact.email}`}>{D.contact.email}</a>
          <span className="ps-foot__hours">Mon–Fri 7:30 AM – 5:00 PM ET</span>
        </div>
        <div>
          <h4>Equipment</h4>
          {D.machines.map((m) => (
            <a key={m.sku} href={`/machine/${m.sku}`}>
              {m.name}
            </a>
          ))}
        </div>
        <div>
          <h4>Information</h4>
          <a href="/compare">Compare machines</a>
          <a href="/freight">Freight &amp; shipping</a>
          <a href="/terms">Terms of sale</a>
          <a href="/privacy">Privacy policy</a>
        </div>
      </div>
      <div className="ps-wrap ps-foot__bot">
        <span>© {new Date().getFullYear()} JM Equipment Inc. — FOB Sturgis, Michigan</span>
        <span>
          <a href="/terms">Terms</a>
          {" · "}
          <a href="/privacy">Privacy</a>
          {" · "}
          <a href="/freight">Shipping</a>
          {" · "}
          Quotations confirmed in writing
        </span>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------- Scroll to top --- */
function ScrollToTop() {
  const [show, setShow] = useState(false);
  const scrollUp = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      className={"ps-totop" + (show ? " show" : "")}
      onClick={scrollUp}
      aria-label="Scroll to top"
    >
      ↑
    </button>
  );
}

/* --------------------------------------------------------------- Tweaks --- */
const ACCENTS: Record<string, string> = { Maroon: "#A8353A", Steel: "#3B5566", Graphite: "#3A3A3E" };
interface Tw {
  accent: string;
  density: string;
  stats: string;
}
function Tweaks({ open, onClose, tw, setTw }: { open: boolean; onClose: () => void; tw: Tw; setTw: (t: Tw) => void }) {
  if (!open) return null;
  return (
    <div className="ps-tweaks" role="dialog" aria-label="Display tweaks">
      <div className="ps-tweaks__hd">
        <b>Tweaks</b>
        <button onClick={onClose} aria-label="Close tweaks">×</button>
      </div>
      <div className="ps-tweaks__row">
        <label>Accent</label>
        <div className="ps-tweaks__sw">
          {Object.entries(ACCENTS).map(([n, c]) => (
            <button
              key={n}
              title={n}
              aria-label={`Accent ${n}`}
              className={tw.accent === c ? "on" : ""}
              style={{ background: c }}
              onClick={() => setTw({ ...tw, accent: c })}
            />
          ))}
        </div>
      </div>
      <div className="ps-tweaks__row">
        <label>Density</label>
        <div className="ps-tweaks__seg">
          {["Comfortable", "Compact"].map((d) => (
            <button key={d} className={tw.density === d ? "on" : ""} onClick={() => setTw({ ...tw, density: d })}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="ps-tweaks__row">
        <label>Hero stats</label>
        <div className="ps-tweaks__seg">
          {["Show", "Hide"].map((d) => (
            <button key={d} className={tw.stats === d ? "on" : ""} onClick={() => setTw({ ...tw, stats: d })}>
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ App --- */
export default function StorefrontPage() {
  const { items, add, setQty, remove } = useRequestList();
  const { message, show } = useToast();
  const [twOpen, setTwOpen] = useState(false);
  const [tw, setTw] = useState<Tw>({ accent: "#A8353A", density: "Comfortable", stats: "Show" });
  const [contact, setContactRaw] = useState<ContactForm>({
    company: "",
    name: "",
    email: "",
    phone: "",
    serial: "",
    website: "",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [sent, setSent] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const setContact = (c: ContactForm) => {
    setContactRaw(c);
    if (sent) setSent(false);
  };

  const blurField = (k: keyof ContactForm) => () => {
    const v = contact[k].trim();
    const next = { ...formErrors };
    if (k === "company" && !v) next.company = "Company is required.";
    else if (k === "company") delete next.company;
    else if (k === "name" && !v) next.name = "Contact name is required.";
    else if (k === "name") delete next.name;
    else if (k === "email" && !v) next.email = "Email is required.";
    else if (k === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) next.email = "Enter a valid email.";
    else if (k === "email") delete next.email;
    setFormErrors(next);
  };

  useReveal();

  if (typeof document !== "undefined") {
    const r = document.documentElement.style;
    if (tw.accent !== "#A8353A") r.setProperty("--jme-red", tw.accent);
    else r.removeProperty("--jme-red");
    document.body.dataset.density = tw.density;
  }

  const count = items.reduce((s, i) => s + (i.qty || 1), 0);

  const jump = (id: string) => {
    const el = id === "top" ? document.body : document.getElementById(id);
    if (el) window.scrollTo({ top: id === "top" ? 0 : el.offsetTop - 70, behavior: "smooth" });
  };

  const addItem = (it: { sku: string; name: string }) => {
    add(it);
    show("Added to request");
  };

  function validate(): boolean {
    const e: Partial<Record<keyof ContactForm, string>> = {};
    if (!contact.company.trim()) e.company = "Company is required.";
    if (!contact.name.trim()) e.name = "Contact name is required.";
    if (!contact.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) e.email = "Enter a valid email.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function sendRequest() {
    if (items.length === 0) return;
    if (!validate()) {
      show("Check the highlighted fields");
      return;
    }
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, items }),
      });
      // Generic handling — the API returns generic messages by design.
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setReference(typeof data.ref === "string" ? data.ref : null);
        setSent(true);
        show("Request sent — desk replies in writing");
      } else {
        show(data.error || "Check the form and try again");
      }
    } catch {
      show("Could not send — try again");
    }
  }

  return (
    <div>
      <a href="#machines" className="ps-skip">Skip to content</a>
      <Nav count={count} onJump={jump} />
      <Hero onJump={jump} statsOn={tw.stats === "Show"} />
      <div className="jme-cutline" />
      <Machines onAdd={addItem} />
      <Industries />
      <Capabilities />
      <Parts onAdd={addItem} />
      <Services />
      <Request
        items={items}
        contact={contact}
        setContact={setContact}
        errors={formErrors}
        onBlur={blurField}
        sent={sent}
        reference={reference}
        onQty={setQty}
        onRemove={remove}
        onSend={sendRequest}
        onPrint={() => window.print()}
      />
      <Trust />
      <Faq />
      <Footer />
      <ScrollToTop />
      <button className="ps-tweaksbtn" onClick={() => setTwOpen(!twOpen)} aria-label="Display tweaks">
        ⚙
      </button>
      <Tweaks open={twOpen} onClose={() => setTwOpen(false)} tw={tw} setTw={setTw} />
      <div className={"ps-toastwrap" + (message ? " show" : "")} role="status" aria-live="polite">
        {message && <Toast tone="green">{message}</Toast>}
      </div>
    </div>
  );
}
