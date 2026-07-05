import type { Metadata } from "next";
import Link from "next/link";
import { PolicyNav } from "@/components/PolicyNav";

export const metadata: Metadata = {
  title: "Freight & Shipping Policy",
  description:
    "Shipping terms, freight quoting, and delivery information for JM Equipment parts and machinery.",
  robots: { index: false, follow: false },
};

export default function FreightPage() {
  return (
    <>
    <PolicyNav />
    <main className="ps-policy">
      <div className="ps-wrap">
        <div className="ps-policy__hd">
          <span className="jme-eyebrow">Shipping</span>
          <h1 className="jme-h2">Freight &amp; Shipping</h1>
          <p className="ps-policy__updated">
            Last reviewed June 2026 &middot; Sandbox&nbsp;draft&nbsp;&mdash;&nbsp;not&nbsp;yet&nbsp;approved
          </p>
        </div>

        <div className="ps-policy__body">
          <section>
            <h2>1. Shipping Origin</h2>
            <p>
              All orders ship FOB (Free On Board) from our facility in Sturgis, Michigan.
              Title and risk of loss transfer to the buyer at the shipping dock.
            </p>
          </section>

          <section>
            <h2>2. Standard Parts Shipping</h2>
            <p>
              In-stock parts with a purchase order received by 2:30 PM Eastern ship the
              same business day via ground carrier. Next-day and rush shipping are
              available on request&mdash;let us know if rush delivery is needed and the
              parts desk will confirm rates and transit times to your location.
            </p>
          </section>

          <section>
            <h2>3. Freight-Heavy &amp; Oversized Items</h2>
            <p>
              Machines, large assemblies, and heavy components require freight quoting.
              These items are flagged &ldquo;Freight Quote Required&rdquo; in the parts
              catalog. Freight charges are quoted separately and confirmed in writing before
              shipping. We coordinate with qualified carriers experienced in handling
              industrial machinery.
            </p>
          </section>

          <section>
            <h2>4. Freight Quote Process</h2>
            <ol>
              <li>Add the item to your request and submit through the parts store.</li>
              <li>The parts desk provides a freight quote alongside the part/machine quote.</li>
              <li>You approve the total (parts + freight) before we ship.</li>
              <li>We coordinate pickup, crating (if required), and carrier scheduling.</li>
            </ol>
          </section>

          <section>
            <h2>5. Packaging &amp; Crating</h2>
            <p>
              Standard parts are packaged for ground shipment. Machines and heavy
              assemblies are crated or skidded for freight. Custom crating is available and
              quoted when required. All shipments are packaged to withstand normal
              conditions of transit.
            </p>
          </section>

          <section>
            <h2>6. International Shipping</h2>
            <p>
              International shipments are available. Export documentation, customs
              brokerage, and international freight are quoted on a per-order basis. Contact
              the parts desk for international shipping arrangements.
            </p>
          </section>

          <section>
            <h2>7. Delivery &amp; Inspection</h2>
            <p>
              Inspect all shipments upon delivery. Note any visible damage on the carrier&rsquo;s
              delivery receipt before signing. Report concealed damage within five (5)
              business days of receipt. Claims for shipping damage are filed with the
              carrier; JME will assist with documentation.
            </p>
          </section>

          <section>
            <h2>8. Contact</h2>
            <p>
              For shipping questions, freight quotes, or to arrange special delivery:
            </p>
            <address>
              JM Equipment Inc. &mdash; Parts Desk<br />
              <a href="tel:(269) 659-0093">(269) 659-0093</a><br />
              <a href="mailto:parts@jmequipment.net">parts@jmequipment.net</a>
            </address>
          </section>

          <div className="ps-policy__note">
            <strong>Note:</strong> This is a sandbox draft for internal review. Final
            policy requires legal review and JM Equipment approval before publication.
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
