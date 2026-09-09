"use client";

import "@/styles/platform.css";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Diamond, Eyebrow, SmartImg, StatusBand, Tag, Toast } from "@/components/ui";
import { SiteNav } from "@/components/SiteNav";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { foreignLines, type MachinePartsResult } from "@/lib/machineParts";
import { useUrlParam } from "@/hooks/useUrlParam";
import type { Machine, Part } from "@/data/types";

export interface PlatformMachine {
  machine: Machine;
  parts: MachinePartsResult;
}

const PARAM = "m";

/**
 * Machine Platform — transcribed from the design reference of the same name.
 * A rail of the nine published lines; picking one shows its detail and only
 * the parts the desk has said fit it. Anything on the request list that
 * belongs to a different family is flagged before it reaches the desk.
 */
export function MachinePlatformClient({
  machines,
  prefixes,
}: {
  machines: PlatformMachine[];
  prefixes: Record<string, string>;
}) {
  const { items, add, count } = useRequestList();
  const { message, show } = useToast();
  // The URL is the initial source of truth (?m=SKU deep links from the
  // storefront and from emails); a click overrides it for this visit. Derived,
  // not synced in an effect, so the server and first client render agree.
  const fromUrl = useUrlParam(PARAM);
  const [picked, setPicked] = useState<string | null>(null);
  const known = (sku: string | null) => (sku && machines.some((m) => m.machine.sku === sku) ? sku : null);
  const sel = picked ?? known(fromUrl) ?? machines[0]!.machine.sku;

  const choose = (sku: string) => {
    setPicked(sku);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, sku);
    window.history.replaceState(null, "", url.pathname + url.search);
  };

  const cur = machines.find((m) => m.machine.sku === sel) ?? machines[0]!;
  const { machine, parts } = cur;
  const foreign = useMemo(() => foreignLines(items, parts.family, prefixes), [items, parts.family, prefixes]);

  const addPart = (p: Part) => {
    add({ sku: p.sku, name: p.name, source: `${machine.name} · fits` });
    show("Added to request");
  };
  const addMachine = () => {
    add({ sku: machine.sku, name: machine.name, source: "Machine Platform" });
    show("Machine added to request");
  };

  return (
    <>
      <SiteNav
        className="mp-nav"
        count={count}
        links={[
          { label: "Catalog", href: "/#parts" },
          { label: "Machine Platform", href: "/machines", current: true },
          { label: "Manuals", href: "/parts/goodstrong" },
          { label: "Compare", href: "/compare" },
        ]}
      />

      <main id="main" className="mp">
        <header className="mp__head">
          <Eyebrow tone="gold">Start with your machine · every line is quote-required</Eyebrow>
          <h1 className="jme-h2 mp__title">Machine Platform</h1>
          <p className="mp__lead">
            Pick the machine you&rsquo;re working on. We&rsquo;ll show only what fits it, and flag anything on your
            request list that belongs to a different machine before it reaches the parts desk.
          </p>
        </header>

        <div className="mp__rail" role="tablist" aria-label="Machine lines">
          {machines.map(({ machine: m }) => (
            <button
              key={m.sku}
              role="tab"
              aria-selected={m.sku === sel}
              className={"mp__tile" + (m.sku === sel ? " on" : "")}
              onClick={() => choose(m.sku)}
            >
              <span className="jme-mono mp__tile-sku">{m.sku}</span>
              <span className="mp__tile-name">{m.name}</span>
              <span className="mp__tile-fam">{m.family}</span>
            </button>
          ))}
        </div>

        <aside className="mp__else">
          <b>Running something else?</b>
          <span>
            These nine are the lines we publish. We support far more machines than we&rsquo;ve indexed — send the
            serial off the data plate and the desk works from the manual.
          </span>
          <Link className="mp__else-link" href="/parts/goodstrong">
            Send us a serial
          </Link>
        </aside>

        {foreign.length > 0 && (
          <div className="mp__guard" role="status">
            <b>Check your request list.</b> {foreign.length === 1 ? "One line" : `${foreign.length} lines`} on it{" "}
            {foreign.length === 1 ? "belongs" : "belong"} to a different machine family than the {machine.name}:{" "}
            {foreign.map((l) => l.sku).join(", ")}. The desk confirms fitment on every quote — mention which machine each
            is for.
          </div>
        )}

        <section className="mp__detail" aria-live="polite">
          <div className={"mp__photo" + (machine.fit === "cover" ? " is-cover" : "")}>
            {machine.photo ? (
              <SmartImg src={`/images/${machine.photo}`} alt={machine.name} />
            ) : (
              <div className="mp__nophoto">
                <Diamond size={96} />
                <span>No JME photograph on file</span>
              </div>
            )}
          </div>
          <div className="mp__body">
            <div className="mp__tags">
              <StatusBand band={machine.statusBand} />
              <Tag tone={machine.tag}>{machine.tagLabel}</Tag>
            </div>
            <h2 className="jme-h2 mp__name">{machine.name}</h2>
            <p className="mp__blurb">{machine.blurb}</p>
            {machine.bestFor && (
              <p className="mp__best">
                <b>Best for</b> {machine.bestFor}
              </p>
            )}
            <dl className="jme-plate jme-plate__rows mp__plate">
              {machine.specs.map((s) => (
                <div className="jme-plate__row" key={s.k}>
                  <dt>{s.k}</dt>
                  <dd className="jme-mono">{s.v}</dd>
                </div>
              ))}
            </dl>
            {machine.outcomes && machine.outcomes.length > 0 && (
              <ul className="mp__outcomes">
                {machine.outcomes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            )}
            <div className="mp__cta">
              <Button onClick={addMachine}>Add machine to request list</Button>
              <Button variant="ghost" href={`/machine/${machine.sku}`}>
                Full detail &amp; configurator
              </Button>
            </div>
          </div>
        </section>

        <section className="mp__parts">
          <div className="ps-sechd">
            <div>
              <Eyebrow tone="gold">Verified fitment</Eyebrow>
              <h2 className="jme-h2">Parts that fit this machine</h2>
            </div>
            <p className="mp__count">
              {parts.fits.length} {parts.fits.length === 1 ? "part" : "parts"}
            </p>
          </div>

          {parts.fits.length > 0 ? (
            <div className="ps-rows mp__rows">
              {parts.fits.map((p) => (
                <div className="ps-row mp__row" key={p.sku}>
                  <div className="ps-row__id">
                    <span className="jme-mono ps-row__sku">{p.sku}</span>
                  </div>
                  <div>
                    <div className="ps-row__name">{p.name}</div>
                    <div className="ps-row__sub">
                      {p.category}
                      {p.fitment ? ` · fits ${p.fitment}` : ""}
                    </div>
                  </div>
                  <div className="ps-row__band">
                    <StatusBand band={p.statusBand} />
                  </div>
                  <div className="ps-row__act">
                    <Button size="sm" onClick={() => addPart(p)}>
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ps-empty mp__empty">
              <p>
                <b>No published parts confirmed for this machine yet.</b> The desk quotes {machine.name} parts from
                your serial and the factory manual
                {parts.confirmTotal > 0 ? ` — or start from the ${parts.family} family parts below.` : "."}
              </p>
              <Button href="/#request">Request parts</Button>
            </div>
          )}

          {parts.confirmTotal > 0 && (
            <div className="mp__confirm">
              <div className="ps-sechd">
                <div>
                  <Tag tone="consult">Confirm fitment</Tag>
                  <h3 className="jme-h2 mp__confirm-title">
                    {parts.confirmTotal.toLocaleString("en-US")} more {parts.family} parts, fitment unconfirmed
                  </h3>
                </div>
              </div>
              <p className="mp__confirm-note">
                These are stocked for the {parts.family} family. Whether a given one fits your {machine.name} depends
                on serial and build — add it and the desk confirms before quoting, or ask first.
              </p>
              <div className="ps-rows mp__rows">
                {parts.confirm.map((p) => (
                  <div className="ps-row mp__row" key={p.sku}>
                    <div className="ps-row__id">
                      <span className="jme-mono ps-row__sku">{p.sku}</span>
                    </div>
                    <div>
                      <div className="ps-row__name">{p.name}</div>
                      <div className="ps-row__sub">{p.category}</div>
                    </div>
                    <div className="ps-row__band">
                      <StatusBand band={p.statusBand} />
                    </div>
                    <div className="ps-row__act">
                      <Button size="sm" variant="ghost" onClick={() => addPart(p)}>
                        Ask about fitment
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {parts.confirmTotal > parts.confirm.length && (
                <p className="mp__more">
                  <Link href="/#parts">
                    Browse all {parts.confirmTotal.toLocaleString("en-US")} {parts.family} parts in the catalogue
                  </Link>
                </p>
              )}
            </div>
          )}
          <p className="mp__fine">Requesting a quote is not an order. We confirm fitment, lead time, and freight in writing.</p>
        </section>
      </main>
      {message && <Toast tone="green">{message}</Toast>}
    </>
  );
}
