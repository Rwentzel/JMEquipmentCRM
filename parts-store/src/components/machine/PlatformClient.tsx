"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PolicyNav } from "@/components/PolicyNav";
import { Button, DataPlate, Diamond, Eyebrow, SmartImg, StatusBand, Tag, Toast } from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { conflictingItems, partsForMachine, publishedFor } from "@/lib/fitment";
import { asset } from "@/lib/utils";
import type { Machine, Part } from "@/data/types";

/**
 * Machine Platform — start with the machine, see only what fits it.
 *
 * The rail is a list of links (`?m=SKU`), so a customer can bookmark or send
 * "the parts for my 1650" and a screen reader gets ordinary navigation. The
 * selected machine's published parts come from the fitment guard; anything on
 * the request list that JME publishes for a *different* machine is flagged
 * gold for a fitment check before it reaches the desk.
 */
export function PlatformClient({ machines, parts }: { machines: Machine[]; parts: Part[] }) {
  const params = useSearchParams();
  const wanted = params.get("m");
  const machine = machines.find((m) => m.sku === wanted) ?? machines[0];
  const { items, add, count } = useRequestList();
  const { message, show } = useToast();

  const fitting = partsForMachine(parts, machine);
  const conflicts = conflictingItems(items, machine, parts);
  const onList = new Set(items.map((i) => i.sku));
  const nameOf = (sku: string) => machines.find((m) => m.sku === sku)?.name ?? sku;

  return (
    <>
      <PolicyNav>
        <Button size="sm" as="a" href="/#request">
          Request List{count > 0 ? ` · ${count}` : ""}
        </Button>
      </PolicyNav>
      <main className="mp">
        <div className="ps-wrap">
          <header className="mp__hd">
            <Eyebrow>Start with your machine · Every line is quote-required</Eyebrow>
            <h1>Machine Platform</h1>
            <p>
              Pick the machine you&rsquo;re working on. We&rsquo;ll show only what fits it, and flag anything on your
              request list that belongs to a different machine before it reaches the parts desk.
            </p>
          </header>

          <div className="mp__grid">
            <nav className="mp-rail" aria-label="Machines">
              <span className="mp-rail__lbl">Published lines · {machines.length}</span>
              {machines.map((m) => {
                const n = partsForMachine(parts, m).length;
                const current = m.sku === machine.sku;
                return (
                  <Link
                    key={m.sku}
                    href={`/machines?m=${encodeURIComponent(m.sku)}`}
                    scroll={false}
                    aria-current={current ? "page" : undefined}
                  >
                    <span className="mp-rail__name">
                      {m.name}
                      <span className="mp-rail__fam">{m.family}</span>
                    </span>
                    <span className={"mp-rail__count" + (n > 0 ? " has" : "")} aria-label={`${n} published parts`}>
                      {n > 0 ? `${n} parts` : "—"}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mp-detail" aria-live="polite">
              <section className="mp-machine" aria-labelledby="mp-machine-name">
                <div className={"mp-machine__photo" + (machine.fit === "contain" ? " is-contain" : "")}>
                  {machine.photo ? (
                    <SmartImg src={asset(machine.photo)} alt={machine.name} priority />
                  ) : (
                    <div className="ps-machine__ph">
                      <Diamond size={44} />
                      <span className="ps-machine__ph-fam">{machine.family}</span>
                      <span className="ps-machine__ph-note">Photo on request</span>
                    </div>
                  )}
                </div>
                <div className="mp-machine__body">
                  <div className="mp-machine__meta">
                    <Tag tone={machine.tag}>{machine.tagLabel}</Tag>
                    <StatusBand band={machine.statusBand} />
                  </div>
                  <h2 id="mp-machine-name">{machine.name}</h2>
                  <span className="mp-machine__sku jme-mono">
                    {machine.sku} · {machine.family}
                  </span>
                  <p className="mp-machine__blurb">{machine.blurb}</p>
                  {machine.bestFor && <p className="mp-machine__best">{machine.bestFor}</p>}
                  {machine.outcomes && machine.outcomes.length > 0 && (
                    <ul className="mp-outcomes">
                      {machine.outcomes.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  )}
                  <DataPlate title="Data plate" sku={machine.sku} rows={machine.specs} headingLevel={3} />
                  <div className="mp-machine__cta">
                    <Button
                      onClick={() => {
                        add({ sku: machine.sku, name: machine.name });
                        show("Machine added to request list");
                      }}
                    >
                      Add machine to request list
                    </Button>
                    <Button variant="ghost" as="a" href={`/machine/${machine.sku}`}>
                      Configure &amp; details
                    </Button>
                  </div>
                  <p className="mp-machine__fine">
                    Requesting a quote is not an order. We confirm fitment, lead time, and freight in writing.
                  </p>
                </div>
              </section>

              {conflicts.length > 0 && (
                <section className="mp-check" aria-label="Fitment check on your request list">
                  <div className="mp-check__hd">
                    <Tag tone="consult">Confirm fitment</Tag>
                    <span>
                      {conflicts.length === 1 ? "1 item" : `${conflicts.length} items`} on your request list
                      {conflicts.length === 1 ? " is" : " are"} published for a different machine than the {machine.name}.
                      The desk checks every line against your serial number, but sending it now saves a round trip.
                    </span>
                  </div>
                  <ul>
                    {conflicts.map((it) => (
                      <li key={it.sku}>
                        <span className="jme-mono mp-part__sku">{it.sku}</span>
                        <span>{it.name}</span>
                        <span className="mp-part__meta">
                          fits{" "}
                          {publishedFor(parts.find((p) => p.sku === it.sku)!)
                            .map(nameOf)
                            .join(" / ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mp-fit" aria-labelledby="mp-fit-hd">
                <div className="mp-fit__hd">
                  <div>
                    <Eyebrow tone="gold">Verified fitment</Eyebrow>
                    <h3 id="mp-fit-hd">Parts that fit this machine</h3>
                  </div>
                  <span className="mp-fit__count">
                    {fitting.length === 1 ? "1 part" : `${fitting.length} parts`}
                  </span>
                </div>
                {fitting.length === 0 ? (
                  <div className="mp-empty">
                    <b>No published parts for this machine yet</b>
                    <p>
                      We stock and source parts for the {machine.name} — they just aren&rsquo;t indexed here yet. Tell
                      us the serial number and what you need, and the desk works from the build sheet.
                    </p>
                    <Button variant="gold" as="a" href="/#request">
                      Request parts
                    </Button>
                  </div>
                ) : (
                  <ul className="mp-fit__list">
                    {fitting.map((p) => (
                      <li className="mp-part" key={p.sku}>
                        <div className="mp-part__main">
                          <span className="mp-part__sku jme-mono">{p.sku}</span>
                          <span className="mp-part__name">{p.name}</span>
                          <span className="mp-part__meta">
                            {p.category && <span className="mp-part__cat">{p.category}</span>}
                            {p.fitment && <span>Fits: {p.fitment}</span>}
                            <StatusBand band={p.statusBand} />
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={onList.has(p.sku) ? "ghost" : "primary"}
                          onClick={() => {
                            add({ sku: p.sku, name: p.name });
                            show("Added to request");
                          }}
                          aria-label={`Add ${p.name} to request list`}
                        >
                          {onList.has(p.sku) ? "Add another" : "Add"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <section className="mp-else" aria-labelledby="mp-else-hd">
            <div>
              <b id="mp-else-hd">Running something else?</b>
              <p>
                These nine are the lines we publish. We support far more machines than we&rsquo;ve indexed — send the
                serial off the data plate and the desk works from the manual.
              </p>
            </div>
            <Button as="a" href="/#request">
              Send us a serial
            </Button>
          </section>

          <p className="mp-foot">
            Fitment shown is what JME publishes for this machine. Serial numbers decide the rest — we check yours
            against the build sheet before quoting. Parts desk (269) 659-0093.
          </p>
        </div>
      </main>

      <div className={"ps-toastwrap" + (message ? " show" : "")} role="status" aria-live="polite">
        {message && <Toast tone="green">{message}</Toast>}
      </div>
    </>
  );
}
