import type { Metadata } from "next";
import Link from "next/link";
import { PolicyNav } from "@/components/PolicyNav";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Terms of Sale",
  description:
    "Terms and conditions governing quotations, orders, and returns at JM Equipment Inc.",
  robots: pageRobots(),
};

export default function TermsPage() {
  return (
    <>
    <PolicyNav />
    <main className="ps-policy">
      <div className="ps-wrap">
        <div className="ps-policy__hd">
          <span className="jme-eyebrow">Legal</span>
          <h1 className="jme-h2">Terms of Sale</h1>
          <p className="ps-policy__updated">
            Last reviewed June 2026 &middot; Sandbox&nbsp;draft&nbsp;&mdash;&nbsp;not&nbsp;yet&nbsp;approved
          </p>
        </div>

        <div className="ps-policy__body">
          <section>
            <h2>1. Quotation &amp; Acceptance</h2>
            <p>
              All quotations issued by JM Equipment Inc. (&ldquo;JME&rdquo;) are valid for
              thirty (30) calendar days unless otherwise stated in writing. Submitting a
              request through the parts store constitutes a request for quotation, not a
              binding order. Orders are binding only when confirmed in writing by JME.
            </p>
          </section>

          <section>
            <h2>2. Pricing</h2>
            <p>
              Prices are quoted individually per request and confirmed in writing. Online
              availability bands are indicative only; exact pricing, stock status, and lead
              times are provided on your quotation. JME reserves the right to adjust
              pricing for orders not confirmed within the quotation validity period.
            </p>
          </section>

          <section>
            <h2>3. Payment Terms</h2>
            <p>
              Standard terms are net&nbsp;30 for approved accounts. New accounts may require
              prepayment or credit approval before order processing. Purchase orders are
              accepted from approved accounts subject to credit review.
            </p>
          </section>

          <section>
            <h2>4. Shipping &amp; Freight</h2>
            <p>
              All shipments are FOB Sturgis, Michigan. Title and risk of loss pass to the
              buyer at the shipping dock. Freight-heavy and oversized items are quoted with
              freight so there are no surprises&mdash;these items are flagged
              &ldquo;Freight Quote Required&rdquo; in the parts catalog. Standard parts
              ship via ground unless expedited service is requested.
            </p>
          </section>

          <section>
            <h2>5. Rush Orders</h2>
            <p>
              Rush processing is available subject to a surcharge. The applicable fee
              depends on order value and is disclosed before order confirmation. Contact the
              parts desk for current rush availability and pricing.
            </p>
          </section>

          <section>
            <h2>6. Tax</h2>
            <p>
              Applicable sales tax is calculated per the ship-to jurisdiction and added to
              the final invoice. Tax-exempt buyers must provide a valid exemption
              certificate before order processing. Exemption certificates are kept on file
              and must be renewed per applicable state requirements.
            </p>
          </section>

          <section>
            <h2>7. Returns &amp; Warranty</h2>
            <p>
              Return requests must be submitted within thirty (30) days of receipt.
              Restocking fees may apply. Custom-built, cut-to-length, and electrical
              components are non-returnable. Warranty terms are stated on the quotation or
              invoice for each item. JME&rsquo;s liability is limited to replacement or
              credit at JME&rsquo;s discretion.
            </p>
          </section>

          <section>
            <h2>8. Limitation of Liability</h2>
            <p>
              JME is not liable for incidental, consequential, or special damages arising
              from the sale, use, or inability to use any product. Compatibility
              information provided online or in quotations is advisory; the buyer is
              responsible for verifying fit for their specific application.
            </p>
          </section>

          <section>
            <h2>9. Governing Law</h2>
            <p>
              These terms are governed by the laws of the State of Michigan. Any disputes
              shall be resolved in the courts of St. Joseph County, Michigan.
            </p>
          </section>

          <div className="ps-policy__note">
            <strong>Note:</strong> This is a sandbox draft for internal review. Final terms
            require legal review and JM Equipment approval before publication.
          </div>
        </div>

        <div className="ps-policy__back">
          <Link className="jme-btn jme-btn--ghost" href="/">
            &larr; Back to the parts store
          </Link>
        </div>
      </div>
    </main>
    </>
  );
}
