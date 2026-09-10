import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/flow.css";
import { Button, Eyebrow } from "@/components/ui";
import { PolicyNav } from "@/components/PolicyNav";
import { pageRobots } from "@/lib/launch";
import { FAQ } from "@/data/faq";

export const metadata: Metadata = {
  title: "How Quoting Works",
  description:
    "Why JM Equipment quotes every part and machine instead of listing prices: build a list, send it with your serial number, and the parts desk confirms fitment, lead time and freight in writing.",
  robots: pageRobots(),
  alternates: { canonical: "/how-quoting-works" },
};

const STEPS: { n: string; title: string; body: string; bullets?: string[] }[] = [
  {
    n: "01",
    title: "Build your list",
    body: "Add machines and parts from the catalog, or work straight out of a factory manual page. Nothing commits you to anything — the list is just what you want priced.",
  },
  {
    n: "02",
    title: "Send it over",
    body: "Tell us who you are and what you're running. The serial number is the single most useful thing you can give us.",
  },
  {
    n: "03",
    title: "We confirm and quote",
    body: "Within one business day — usually the same day — the parts desk comes back with a written quote covering:",
    bullets: [
      "Verified fitment against your machine, with anything ambiguous flagged",
      "Lead time per line item",
      "Freight, quoted properly on heavy assemblies",
      "Alternates where a part has been superseded",
    ],
  },
  {
    n: "04",
    title: "Approve and it ships",
    body: "Reply to the quote and we move to a firm order on the terms it states. No card on file to get there, and no surprises on the invoice.",
  },
];

const ASK = [
  "Machine model and serial number from the data plate",
  "The part number or catalogue page you're working from",
  "Where it ships, so freight is priced not guessed",
  "How urgent it is — we flag line-down orders",
];

const NEVER = [
  "Sell or share your contact details for marketing",
  "Put you on a mailing list you didn't ask for",
  "Require an account or a card to get a quote",
  "Ship a part we haven't confirmed fits",
];

/**
 * RFQ Flow — transcribed from the design reference of the same name. The
 * one page that explains, in the customer's terms, why nothing on the site
 * carries a price and what happens after they send a list. Static: there is
 * nothing here to submit, and every claim is the storefront's own.
 */
export default function HowQuotingWorksPage() {
  return (
    <>
      <PolicyNav />
      <main id="main" className="fl">
        <header className="fl__head">
          <Eyebrow tone="gold">RFQ-first, since 1989</Eyebrow>
          <h1 className="jme-h2 fl__title">
            Why you won&rsquo;t
            <br />
            see a price tag
          </h1>
          <p className="fl__lead">
            Converting equipment isn&rsquo;t catalog merchandise. The same part number fits differently depending on
            serial, model year, and how the line was configured when it shipped. Quoting directly is how we make sure
            what arrives is what bolts on.
          </p>
        </header>

        <ol className="fl__steps" aria-label="The four steps">
          {STEPS.map((s) => (
            <li key={s.n} className="fl__step">
              <span className="fl__n" aria-hidden>
                {s.n}
              </span>
              <div>
                <h2 className="fl__step-t">{s.title}</h2>
                <p>{s.body}</p>
                {s.bullets && (
                  <ul className="fl__bullets">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="fl__cols">
          <section className="fl__col fl__col--ask" aria-labelledby="fl-ask">
            <h2 id="fl-ask" className="fl__col-t">
              What we ask for
            </h2>
            <ul>
              {ASK.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
          <section className="fl__col" aria-labelledby="fl-never">
            <h2 id="fl-never" className="fl__col-t">
              What we never do
            </h2>
            <ul>
              {NEVER.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="fl__ready" aria-labelledby="fl-ready">
          <div>
            <h2 id="fl-ready" className="fl__col-t fl__ready-t">
              Ready when you are
            </h2>
            <p>Build a list from the catalogue, or call the desk and describe the problem.</p>
            <p className="jme-mono fl__contact">
              <a href="tel:+12696590093">(269) 659-0093</a> &middot; <a href="mailto:parts@jmequipment.net">parts@jmequipment.net</a>
            </p>
          </div>
          <div className="ps-actions fl__actions">
            <Button as="a" href="/#parts">
              Browse the catalog
            </Button>
            <Button as="a" variant="ghost" href="/parts/goodstrong">
              Open a manual
            </Button>
          </div>
        </section>

        {/* Owner ruling (BUILD_PROMPT.md): the explainer carries the FAQ, so the
            same answers the storefront and the assistant give live here too. */}
        <section className="fl__faq" aria-labelledby="fl-faq">
          <h2 id="fl-faq" className="fl__col-t">
            Common questions
          </h2>
          <div className="ps-faq">
            {FAQ.map((f) => (
              <details className="ps-faq__item" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="fl__more">
          Questions about a machine you already run? The <Link href="/support">Support Hub</Link> takes manual, fitment
          and service requests by serial number. Freight terms are on the{" "}
          <Link href="/freight">shipping page</Link>.
        </p>
      </main>
    </>
  );
}
