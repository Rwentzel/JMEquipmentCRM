"use client";

import { useMemo, useState } from "react";
import { Button, Callout, DataPlate, Diamond, Eyebrow, SmartImg, SpecTable, StatBlock, StatusBand, Tag, Toast } from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { asset, actionLabel } from "@/lib/utils";
import type { Machine, MachineDetail, Part } from "@/data/types";

const SECTIONS: [string, string][] = [
  ["overview", "Overview"],
  ["configure", "Configure"],
  ["how", "How it works"],
  ["specs", "Specs"],
  ["apps", "Applications"],
  ["parts", "Parts"],
  ["resources", "Resources"],
];

export function MachineDetailClient({
  machine,
  detail,
  relatedParts,
}: {
  machine: Machine;
  detail: MachineDetail;
  relatedParts: Part[];
}) {
  const { add, count } = useRequestList();
  const { message, show } = useToast();
  const active = useScrollSpy(SECTIONS.map((s) => s[0]));

  // Configure: track the selected choice (by sku) per radio option, and a set
  // of selected add-on skus for check options.
  const [radio, setRadio] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    detail.options.forEach((o) => {
      if (o.type === "radio") init[o.id] = o.choices[0]?.sku ?? "";
    });
    return init;
  });
  const [checks, setChecks] = useState<Set<string>>(new Set());

  // Build a human list of the current selection (no prices — feeds the RFQ).
  const selection = useMemo(() => {
    const lines: string[] = [];
    detail.options.forEach((o) => {
      if (o.type === "radio") {
        const sel = o.choices.find((c) => c.sku === radio[o.id]);
        if (sel) lines.push(`${o.label}: ${sel.v}`);
      } else {
        const picked = o.choices.filter((c) => checks.has(o.id + ":" + c.sku));
        if (picked.length) lines.push(`${o.label}: ${picked.map((c) => c.v).join(", ")}`);
      }
    });
    return lines;
  }, [detail, radio, checks]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 110, behavior: "smooth" });
  };

  const addMachine = () => {
    add({ sku: machine.sku, name: machine.name });
    show("Added to request");
  };

  const hero = detail.gallery[0];

  return (
    <div>
      {/* Top bar */}
      <div className="md-top">
        <div className="md-top__in">
          <a className="brand" href="/">
            <Diamond size={28} />
            <span>
              <b>JM Equipment</b>
              <small>Converting Machinery Solutions</small>
            </span>
          </a>
          <a className="md-phone" href="tel:(269) 659-0093">
            (269) 659-0093
          </a>
        </div>
      </div>

      {/* Sub-nav with scroll spy */}
      <div className="md-subnav">
        <div className="md-subnav__in">
          <a className="md-back" href="/">
            ← All machines
          </a>
          <div className="md-subnav__links">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className={active === id ? "on" : ""}
                aria-current={active === id ? "true" : undefined}
                onClick={(e) => { e.preventDefault(); jump(id); }}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="md-reqbtn">
            <Button size="sm" as="a" href="/#request">
              Request List{count > 0 ? ` · ${count}` : ""}
            </Button>
          </div>
        </div>
      </div>

      {/* Hero / Overview */}
      <header id="overview" className="md-hero">
        <div className="md-hero__grid">
          <div>
            <div className="md-crumb">
              Equipment · {machine.family ?? "Machine"}
            </div>
            <Eyebrow>{machine.tagLabel}</Eyebrow>
            <h1 className="md-h1">{machine.name}</h1>
            <p className="md-tagline">{detail.tagline}</p>
            <div className="md-hero__stats">
              <StatBlock stats={detail.heroStats} />
            </div>
            <div className="md-hero__cta">
              <Button size="lg" onClick={addMachine}>
                {actionLabel(machine.action)}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => jump("configure")}>
                Configure
              </Button>
            </div>
            <div className="md-hero__meta">
              <StatusBand band={detail.badge.band} />
            </div>
          </div>
          <div className="md-hero__photo">
            {hero ? (
              <SmartImg src={asset(hero.src)} alt={hero.cap} style={{ objectFit: hero.fit === "cover" ? "cover" : "contain" }} />
            ) : (
              <div className="md-hero__ph">
                <Diamond size={64} />
              </div>
            )}
            {hero && <span className="md-hero__cap">{hero.cap}</span>}
          </div>
        </div>
      </header>

      {/* Configure */}
      <section id="configure" className="md-sec">
        <div className="md-sec__in">
          <Eyebrow tone="gold">Your machine, your way</Eyebrow>
          <h2>Configure</h2>
          <div className="md-config">
            <div>
              {detail.options.map((o) => (
                <div className="md-opt" key={o.id}>
                  <label>
                    {o.label}
                    {o.type === "check" ? " (select any)" : ""}
                  </label>
                  <div className="md-choices">
                    {o.choices.map((c) => {
                      const on =
                        o.type === "radio" ? radio[o.id] === c.sku : checks.has(o.id + ":" + c.sku);
                      const toggle = () => {
                        if (o.type === "radio") {
                          setRadio((r) => ({ ...r, [o.id]: c.sku }));
                        } else {
                          setChecks((prev) => {
                            const next = new Set(prev);
                            const key = o.id + ":" + c.sku;
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          });
                        }
                      };
                      return (
                        <div
                          key={c.sku}
                          className={"md-choice" + (on ? " on" : "")}
                          role={o.type === "radio" ? "radio" : "checkbox"}
                          aria-checked={on}
                          tabIndex={0}
                          onClick={toggle}
                          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } }}
                        >
                          <div className="md-choice__v">
                            <span>{c.v}</span>
                            {c.note && <span className="md-choice__note">{c.note}</span>}
                          </div>
                          <span className="md-choice__price" aria-hidden>
                            {on ? "✓" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="md-config__summary">
              <div className="jme-card">
                <div className="jme-card__hd">
                  <h3>Your configuration</h3>
                  <StatusBand band={detail.badge.band} />
                </div>
                <div className="jme-card__body">
                  {selection.length === 0 ? (
                    <p style={{ color: "var(--paper-dim)", fontSize: "var(--t-sm)" }}>
                      Standard configuration. Select options to refine your request.
                    </p>
                  ) : (
                    <ul className="md-config__list">
                      {selection.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  <Callout title="Quoted individually">
                    Pricing, freight, and lead time are confirmed in writing by the parts desk. Add your configuration
                    to the request list to get a firm written quotation.
                  </Callout>
                  <div style={{ marginTop: 16 }}>
                    <Button block onClick={addMachine}>
                      {actionLabel(machine.action)}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="md-sec">
        <div className="md-sec__in">
          <Eyebrow>How it works</Eyebrow>
          <h2>From load to recover</h2>
          <p className="md-tagline" style={{ maxWidth: "62ch" }}>
            {detail.lead}
          </p>
          <div className="md-grid-2" style={{ marginTop: 24 }}>
            {detail.how.map((s) => (
              <div className="md-step" key={s.n}>
                <span className="md-step__n">{s.n}</span>
                <div>
                  <h4>{s.t}</h4>
                  <p>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specs */}
      <section id="specs" className="md-sec">
        <div className="md-sec__in">
          <Eyebrow>Specifications</Eyebrow>
          <h2>Specs</h2>
          <div className="md-grid-2">
            <DataPlate title={machine.name} sku={machine.sku} rows={machine.specs} />
            <Callout title="Proof">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <StatBlock stats={[{ value: detail.proof.stat, label: detail.proof.label }]} />
                <span>{detail.proof.quote}</span>
              </div>
            </Callout>
          </div>
        </div>
      </section>

      {/* Applications */}
      <section id="apps" className="md-sec">
        <div className="md-sec__in">
          <Eyebrow>Applications</Eyebrow>
          <h2>Where it runs</h2>
          <div className="md-grid-3">
            {detail.apps.map((a) => (
              <div className="md-appcard" key={a}>
                <h4>{a}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parts */}
      <section id="parts" className="md-sec">
        <div className="md-sec__in">
          <Eyebrow>Related parts</Eyebrow>
          <h2>Keep it running</h2>
          {relatedParts.length > 0 ? (
            <SpecTable
              columns={[
                { key: "sku", label: "Part #" },
                { key: "name", label: "Description" },
                { key: "status", label: "Availability" },
                { key: "act", label: "", align: "right" },
              ]}
            >
              {relatedParts.map((p) => (
                <tr key={p.sku}>
                  <td className="jme-mono" style={{ color: "var(--jme-gold)" }}>
                    {p.sku}
                  </td>
                  <td>{p.name}</td>
                  <td>
                    <StatusBand band={p.statusBand} />
                  </td>
                  <td className="r">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        add({ sku: p.sku, name: p.name });
                        show("Added to request");
                      }}
                    >
                      {actionLabel(p.action)}
                    </Button>
                  </td>
                </tr>
              ))}
            </SpecTable>
          ) : (
            <p className="md-tagline">Parts for this machine are quoted on request — call the parts desk.</p>
          )}
        </div>
      </section>

      {/* Resources */}
      <section id="resources" className="md-sec">
        <div className="md-sec__in">
          <Eyebrow>Resources</Eyebrow>
          <h2>Documentation</h2>
          <div className="md-grid-3">
            {detail.downloads.map((d) => (
              <div className="md-rescard" key={d.t}>
                <Tag tone="consult">PDF</Tag>
                <h4 style={{ marginTop: 8 }}>{d.t}</h4>
                <p>{d.m}</p>
                <p style={{ marginTop: 8, fontSize: "var(--t-2xs)", color: "var(--paper-faint)" }}>
                  Available on request — sandbox build.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={"ps-toastwrap" + (message ? " show" : "")} role="status" aria-live="polite">
        {message && <Toast tone="green">{message}</Toast>}
      </div>
    </div>
  );
}
