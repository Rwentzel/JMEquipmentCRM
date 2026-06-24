"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  DataPlate,
  Diamond,
  Eyebrow,
  Field,
  SmartImg,
  StatBlock,
  Tag,
  Toast,
} from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { useReveal } from "@/hooks/useReveal";
import { catalog } from "@/data/catalog";
import type { Machine, Part } from "@/data/types";
import { usd, asset } from "@/lib/utils";

const D = catalog;

/* ---------------------------------------------------------------- Photo --- */
function MachinePhoto({ m }: { m: Machine }) {
  if (m.photo) {
    return <SmartImg src={asset(m.photo)} alt={m.name} style={{ objectFit: m.fit === "contain" ? "contain" : "cover" }} />;
  }
  return (
    <div className="ps-machine__ph">
      <Diamond size={48} />
      <span>Photo on request</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Nav --- */
function Nav({ count, onJump }: { count: number; onJump: (id: string) => void }) {
  const links = ["Machines", "Parts", "Request", "Why JME"];
  return (
    <nav className="ps-nav">
      <div className="ps-nav__in">
        <a className="brand" onClick={() => onJump("top")}>
          <Diamond size={30} />
          <span>
            <b>JM Equipment</b>
            <small>Converting Machinery Solutions</small>
          </span>
        </a>
        <div className="ps-nav__links">
          {links.map((l) => (
            <a key={l} onClick={() => onJump(l.toLowerCase().replace(/[^a-z]/g, ""))}>
              {l}
            </a>
          ))}
          <a href="/compare">Compare</a>
        </div>
        <Button size="sm" onClick={() => onJump("request")}>
          Request List{count > 0 ? ` · ${count}` : ""}
        </Button>
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
          {statsOn && (
            <div style={{ marginTop: 34, maxWidth: 520 }}>
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
function Machines({ onAdd }: { onAdd: (it: { sku: string; name: string; price: number | null }) => void }) {
  return (
    <section id="machines" className="ps-sec">
      <div className="ps-wrap">
        <div className="ps-sechd">
          <div>
            <Eyebrow>Equipment</Eyebrow>
            <h2 className="jme-h2">Machines</h2>
          </div>
          <p>
            Factory-direct sheeters, rebuilt rollstands, and the hydraulic core splitter. Machine pricing is quoted
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
                  <Badge status={m.status}>{m.statusLabel}</Badge>
                  <div className="ps-machine__acts">
                    <a className="ps-machine__link" href={`/machine/${m.sku}`}>
                      View machine →
                    </a>
                    <Button size="sm" onClick={() => onAdd({ sku: m.sku, name: m.name, price: null })}>
                      Add
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

/* ----------------------------------------------------------------- Parts --- */
function Parts({ onAdd }: { onAdd: (it: { sku: string; name: string; price: number | null }) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const results = useMemo<Part[]>(
    () =>
      D.parts.filter((p) => {
        const inCat = cat === "All" || p.cat === cat;
        const inQ = !q || (p.sku + " " + p.name).toLowerCase().includes(q.toLowerCase());
        return inCat && inQ;
      }),
    [q, cat],
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
            98% of stocked parts ship same day from Sturgis. Search by number or description — can&apos;t find it? Send a
            custom request and the desk answers in writing.
          </p>
        </div>
        <div className="ps-search">
          <input
            className="jme-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search — e.g. JM108, blade, filter, valve"
          />
        </div>
        <div className="ps-chips">
          {D.cats.map((c) => (
            <button key={c} className={"ps-chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="ps-meta">
          {results.length} part{results.length !== 1 ? "s" : ""}
        </div>
        <div className="ps-parts">
          {results.map((p) => (
            <div className="ps-part" key={p.sku}>
              <div className="ps-part__top">
                <span className="jme-mono ps-part__sku">{p.sku}</span>
                <Badge status={p.status}>{p.statusLabel}</Badge>
              </div>
              <div className="ps-part__name">{p.name}</div>
              <Tag>{p.cat}</Tag>
              <div className="ps-part__foot">
                <span className="ps-part__price jme-mono">{p.price == null ? "Quote" : usd(p.price)}</span>
                <Button size="sm" variant="ghost" onClick={() => onAdd({ sku: p.sku, name: p.name, price: p.price })}>
                  Add
                </Button>
              </div>
            </div>
          ))}
          {results.length === 0 && <div className="ps-empty">No match — send a custom part request.</div>}
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
}

function Request({
  items,
  contact,
  setContact,
  onQty,
  onRemove,
  onSend,
  onPrint,
}: {
  items: ReturnType<typeof useRequestList>["items"];
  contact: ContactForm;
  setContact: (c: ContactForm) => void;
  onQty: (sku: string, qty: number) => void;
  onRemove: (sku: string) => void;
  onSend: () => void;
  onPrint: () => void;
}) {
  const lines = items.filter((i) => i.price != null);
  const subtotal = lines.reduce((s, i) => s + (i.price as number) * i.qty, 0);
  const consult = items.filter((i) => i.price == null);
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
          <div className="jme-card" style={{ background: "var(--charcoal)" }}>
            <div className="jme-card__hd">
              <h3>Who should we answer?</h3>
              <span className="jme-mono" style={{ fontSize: 12, color: "var(--jme-gold)" }}>
                R-260622-1
              </span>
            </div>
            <div className="jme-card__body">
              <div className="ps-fgrid">
                <Field label="Company" placeholder="Your company" value={contact.company} onChange={set("company")} />
                <Field label="Contact name" placeholder="Full name" value={contact.name} onChange={set("name")} />
                <Field
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  value={contact.email}
                  onChange={set("email")}
                />
                <Field label="Phone" placeholder="(000) 000-0000" value={contact.phone} onChange={set("phone")} />
              </div>
              <div style={{ marginTop: 14 }}>
                <Field
                  label="Sheeter serial number"
                  placeholder="From the machine dataplate"
                  value={contact.serial}
                  onChange={set("serial")}
                />
              </div>
            </div>
          </div>
          <div className="jme-card" style={{ background: "var(--charcoal)" }}>
            <div className="jme-card__hd">
              <h3>Line items</h3>
              <span style={{ fontSize: 12, color: "var(--paper-dim)" }}>{items.length} item(s)</span>
            </div>
            <div className="jme-card__body">
              {items.length === 0 && <div className="ps-empty">Your request list is empty.</div>}
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
                      onChange={(e) => onQty(i.sku, Math.max(1, Number(e.target.value) || 1))}
                    />
                    <span className="ps-line__price jme-mono">
                      {i.price == null ? "Quote" : usd(i.price * i.qty)}
                    </span>
                    <button className="ps-rm" onClick={() => onRemove(i.sku)} aria-label="Remove">
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {items.length > 0 && (
                <div className="ps-tot">
                  <div className="ps-tot__row">
                    <span>Parts subtotal (budgetary)</span>
                    <b className="jme-mono">{usd(subtotal)}</b>
                  </div>
                  {consult.length > 0 && (
                    <div className="ps-tot__row">
                      <span>Machines</span>
                      <b style={{ color: "var(--jme-gold)" }}>{consult.length} quoted</b>
                    </div>
                  )}
                </div>
              )}
              <div className="ps-actions">
                <Button onClick={onSend} disabled={items.length === 0}>
                  Send request
                </Button>
                <Button variant="ghost" onClick={onPrint}>
                  Print summary
                </Button>
              </div>
              <p className="ps-fine">
                Catalog prices are budgetary, confirmed in writing before processing · No minimum order · FOB Sturgis, MI
                · Tax per ship-to jurisdiction on final invoice.
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

/* --------------------------------------------------------------- Footer --- */
function Footer() {
  return (
    <footer className="ps-foot">
      <div className="ps-wrap ps-foot__grid">
        <div>
          <div className="brand" style={{ marginBottom: 14 }}>
            <Diamond size={30} />
            <span>
              <b style={{ fontSize: 22 }}>JM Equipment</b>
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
        </div>
        <div>
          <h4>Equipment</h4>
          {D.machines.map((m) => (
            <a key={m.sku} href={`/machine/${m.sku}`}>
              {m.name}
            </a>
          ))}
        </div>
      </div>
      <div className="ps-wrap ps-foot__bot">
        <span>© {new Date().getFullYear()} JM Equipment Inc. — FOB Sturgis, Michigan</span>
        <span>Quotations confirmed in writing · No minimum order</span>
      </div>
    </footer>
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
    <div className="ps-tweaks">
      <div className="ps-tweaks__hd">
        <b>Tweaks</b>
        <button onClick={onClose}>×</button>
      </div>
      <div className="ps-tweaks__row">
        <label>Accent</label>
        <div className="ps-tweaks__sw">
          {Object.entries(ACCENTS).map(([n, c]) => (
            <button
              key={n}
              title={n}
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
  const [contact, setContact] = useState<ContactForm>({ company: "", name: "", email: "", phone: "", serial: "" });

  useReveal();

  // Apply tweaks (accent + density) to the document.
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

  const addItem = (it: { sku: string; name: string; price: number | null }) => {
    add(it);
    show("Added to request");
  };

  async function sendRequest() {
    if (items.length === 0) return;
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, items }),
      });
      const data = await res.json();
      show(res.ok ? "Request sent — desk replies in writing" : data.error || "Check the form and try again");
    } catch {
      show("Could not send — try again");
    }
  }

  return (
    <div>
      <Nav count={count} onJump={jump} />
      <Hero onJump={jump} statsOn={tw.stats === "Show"} />
      <div className="jme-cutline" />
      <Machines onAdd={addItem} />
      <Industries />
      <Parts onAdd={addItem} />
      <Services />
      <Request
        items={items}
        contact={contact}
        setContact={setContact}
        onQty={setQty}
        onRemove={remove}
        onSend={sendRequest}
        onPrint={() => show("Summary ready to print")}
      />
      <Trust />
      <Footer />
      <button className="ps-tweaksbtn" onClick={() => setTwOpen(!twOpen)} aria-label="Tweaks">
        ⚙
      </button>
      <Tweaks open={twOpen} onClose={() => setTwOpen(false)} tw={tw} setTw={setTw} />
      <div className={"ps-toastwrap" + (message ? " show" : "")}>{message && <Toast tone="green">{message}</Toast>}</div>
    </div>
  );
}
