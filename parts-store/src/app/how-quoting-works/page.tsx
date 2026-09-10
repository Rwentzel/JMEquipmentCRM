import type { Metadata } from "next";
import Link from "next/link";
import { PolicyNav } from "@/components/PolicyNav";
import { Eyebrow } from "@/components/ui";
import { FAQ } from "@/data/faq";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "How Quoting Works — JM Equipment",
  description:
    "Why JM Equipment quotes every part and machine in writing instead of showing a price tag: build a list, send it over, the desk confirms fitment, lead time and freight, you approve and it ships.",
  robots: pageRobots(),
  alternates: { canonical: "/how-quoting-works" },
};

const STEPS: { n: string; t: string; d: string; bullets?: string[] }[] = [
  {
    n: "01",
    t: "Build your list",
    d: "Add machines and parts from the catalog, or work straight out of a factory manual page. Nothing commits you to anything — the list is just what you want priced.",
  },
  {
    n: "02",
    t: "Send it over",
    d: "Tell us who you are and what you're running. The serial number is the single most useful thing you can give us.",
  },
  {
    n: "03",
    t: "We confirm and quote",
    d: "Within one business day the parts desk comes back with a written quote covering:",
    bullets: [
      "Verified fitment against your machine, with anything ambiguous flagged",
      "Lead time per line item",
      "Freight, quoted properly on heavy assemblies",
      "Alternates where a part has been superseded",
    ],
  },
  {
    n: "04",
    t: "Approve and it ships",
    d: "Reply to the quote and we move to a firm order. No account, no card on file, no surprises on the invoice.",
  },
];

const ASK = [
  "Machine model and serial number from the data plate",
  "The part number or catalogue page you're working from",
  "Where it ships, so freight is priced not guessed",
  "How urgent it is — we flag line-down orders",
];

const NEVER = [
  "Share your contact details with anyone else",
  "Put you on a mailing list you didn't ask for",
  "Require an account or a card to get a quote",
  "Ship a part we haven't confirmed fits",
];

/**
 * RFQ Flow — the explainer behind "why no price tag". Static content plus the
 * five public FAQ entries from data/faq.ts (the same ones the storefront and
 * the support assistant use), so the answer to "how fast do parts ship" is
 * written once.
 */
export default function HowQuotingWorksPage() {
  return (
    <>
      <PolicyNav />
      <main className="rf">
        <div className="ps-wrap">
          <header className="rf__hd">
            <Eyebrow>RFQ-first, since 1989</Eyebrow>
            <h1>
              Why you won&rsquo;t
              <br />
              see a price tag
            </h1>
            <p>
              Converting equipment isn&rsquo;t catalog merchandise. The same part number fits differently depending on
              serial, model year, and how the line was configured when it shipped. Quoting directly is how we make sure
              what arrives is what bolts on.
            </p>
          </header>

          <ol className="rf-steps" aria-label="How quoting works">
            {STEPS.map((s) => (
              <li className="rf-step" key={s.n}>
                <span className="rf-step__n" aria-hidden>
                  {s.n}
                </span>
                <div>
                  <h2>{s.t}</h2>
                  <p>{s.d}</p>
                  {s.bullets && (
                    <ul className="rf-step__list">
                      {s.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="rf-cols">
            <section className="rf-col" aria-labelledby="rf-ask">
              <h2 id="rf-ask">What we ask for</h2>
              <ul>
                {ASK.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
            <section className="rf-col rf-col--never" aria-labelledby="rf-never">
              <h2 id="rf-never">What we never do</h2>
              <ul>
                {NEVER.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rf-faq" aria-labelledby="rf-faq-hd">
            <div className="rf-faq__hd">
              <Eyebrow tone="gold">Common questions</Eyebrow>
              <h2 id="rf-faq-hd">Straight answers from the desk</h2>
            </div>
            <div className="ps-faq">
              {FAQ.map((f) => (
                <details className="ps-faq__item" key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="rf-ready" aria-labelledby="rf-ready-hd">
            <div>
              <h2 id="rf-ready-hd">Ready when you are</h2>
              <p>Build a list from the catalogue, or call the desk and describe the problem.</p>
              <p className="rf-ready__contact">
                <a href="tel:+12696590093">(269) 659-0093</a> &middot;{" "}
                <a href="mailto:parts@jmequipment.net">parts@jmequipment.net</a>
              </p>
            </div>
            <div className="rf-ready__cta">
              <Link className="jme-btn" href="/#parts">
                Browse the catalog
              </Link>
              <Link className="jme-btn jme-btn--ghost" href="/parts/goodstrong">
                Open a manual
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
