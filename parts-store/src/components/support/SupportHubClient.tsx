"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { PolicyNav } from "@/components/PolicyNav";
import { Button, Eyebrow } from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { SupportPanel } from "./SupportPanel";
import { KNOWN_ISSUES, PANELS, isPanelKey, type PanelKey } from "./panels";

/**
 * Support Hub — six typed paths to one parts desk.
 *
 * Each card opens a panel; the open panel is the `?panel=` query parameter,
 * so a link in an email signature or an order confirmation can land a
 * customer straight on "Request a manual". The page behind an open panel is
 * `inert`, so keyboard and screen-reader focus cannot wander out of it.
 */
export function SupportHubClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { count } = useRequestList();
  const raw = params.get("panel");
  const open: PanelKey | null = isPanelKey(raw) ? raw : null;

  const show = useCallback((key: PanelKey) => router.push(`/support?panel=${key}`, { scroll: false }), [router]);
  const close = useCallback(() => router.replace("/support", { scroll: false }), [router]);

  return (
    <>
      <div inert={open ? true : undefined}>
        <PolicyNav>
          <Button size="sm" as="a" href="/#request">
            Request List{count > 0 ? ` · ${count}` : ""}
          </Button>
        </PolicyNav>
        <main className="sh">
          <div className="ps-wrap">
            <header className="sh__hd">
              <Eyebrow>Sturgis, Michigan</Eyebrow>
              <h1>Support &amp; Resources</h1>
              <p>
                Troubleshooting, manuals, service requests, and direct access to our technical team. Every form here
                reaches the same parts desk in Sturgis — you&rsquo;ll get a reference number on screen and a reply
                from a person.
              </p>
            </header>

            <div className="sh-bar" aria-label="Contact the desk">
              <div className="sh-bar__cell">
                <span className="sh-bar__lbl">Sales &amp; support</span>
                <a className="sh-bar__big" href="tel:+12696590093">
                  (269) 659-0093
                </a>
                <span className="sh-bar__sub">9am–5pm EST, Mon–Fri</span>
              </div>
              <div className="sh-bar__cell">
                <span className="sh-bar__lbl">Parts desk</span>
                <a className="sh-bar__big" href="mailto:parts@jmequipment.net">
                  parts@jmequipment.net
                </a>
                <span className="sh-bar__sub">Quote turnaround: 24 hrs</span>
              </div>
              <div className="sh-bar__cell">
                <span className="sh-bar__lbl">Service requests</span>
                <button type="button" className="sh-bar__big sh-bar__btn" onClick={() => show("service")}>
                  Submit request
                </button>
                <span className="sh-bar__sub">Field service, repairs</span>
              </div>
            </div>

            <section className="sh-sec" aria-labelledby="sh-help">
              <div className="sh-sec__hd">
                <Eyebrow>Get help</Eyebrow>
                <h2 id="sh-help">Six paths, all answered from one floor</h2>
              </div>
              <div className="sh-cards">
                {PANELS.map((p) => (
                  <article className="sh-card" key={p.key}>
                    <span className="sh-card__kicker">{p.kicker}</span>
                    <h3>{p.card}</h3>
                    <p>{p.blurb}</p>
                    <Button
                      size="sm"
                      variant={p.key === "contact" ? "gold" : "primary"}
                      onClick={() => show(p.key)}
                      aria-haspopup="dialog"
                    >
                      {p.cta}
                    </Button>
                  </article>
                ))}
              </div>
            </section>

            <section className="sh-sec" aria-labelledby="sh-known">
              <div className="sh-sec__hd">
                <Eyebrow tone="gold">Known issues</Eyebrow>
                <h2 id="sh-known">What the desk is currently fielding</h2>
              </div>
              <div className="sh-issues">
                {KNOWN_ISSUES.map((k) => (
                  <article className={"sh-issue" + (k.pending ? " sh-issue--pending" : "")} key={k.title}>
                    <h3>{k.title}</h3>
                    <p>{k.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sh-send" aria-labelledby="sh-send-hd">
              <div>
                <h2 id="sh-send-hd">Send us what you have</h2>
                <p>
                  A photo of the dataplate, a manual page, or the old part in your hand is enough to start. We&rsquo;d
                  rather confirm fitment from your serial number than guess from a description — that&rsquo;s how the
                  wrong part gets shipped.
                </p>
              </div>
              <Link className="jme-btn jme-btn--gold" href="/#request">
                Open your request list
              </Link>
            </section>

            <address className="sh-addr">
              <span className="sh-addr__lbl">One floor in Sturgis</span>
              405 1/2 W Congress St
              <br />
              Sturgis, MI 49091
              <br />
              <span className="sh-addr__fob">FOB Sturgis, MI</span>
            </address>
          </div>
        </main>
      </div>
      {open && <SupportPanel panelKey={open} onClose={close} onSwitch={show} />}
    </>
  );
}
