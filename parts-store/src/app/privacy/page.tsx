import type { Metadata } from "next";
import Link from "next/link";
import { PolicyNav } from "@/components/PolicyNav";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How JM Equipment Inc. collects, uses, and protects your information.",
  robots: pageRobots(),
};

export default function PrivacyPage() {
  return (
    <>
    <PolicyNav />
    <main className="ps-policy">
      <div className="ps-wrap">
        <div className="ps-policy__hd">
          <span className="jme-eyebrow">Legal</span>
          <h1 className="jme-h2">Privacy Policy</h1>
          <p className="ps-policy__updated">
            Last reviewed June 2026 &middot; Sandbox&nbsp;draft&nbsp;&mdash;&nbsp;not&nbsp;yet&nbsp;approved
          </p>
        </div>

        <div className="ps-policy__body">
          <section>
            <h2>1. Information We Collect</h2>
            <p>
              When you submit a quote request through our parts store, we collect your
              company name, contact name, email address, phone number (optional), and
              machine serial number (optional). We do not collect payment information
              through this site.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>
              The information you provide is used solely to respond to your quote request
              and to communicate about your order. We do not sell, rent, or share your
              personal information with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2>3. Data Storage &amp; Security</h2>
            <p>
              Quote request data is transmitted securely and stored only as long as
              necessary to fulfill the request and maintain business records. We employ
              industry-standard security measures including encrypted transmission,
              server-side validation, and access controls. No sensitive data (such as
              payment details) is collected or stored on this site.
            </p>
          </section>

          <section>
            <h2>4. Cookies &amp; Analytics</h2>
            <p>
              This site uses only essential cookies required for site functionality (such
              as session management). We do not currently use third-party analytics or
              tracking cookies. If analytics are added in the future, we will update this
              policy and provide appropriate notice.
            </p>
          </section>

          <section>
            <h2>5. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal
              information at any time by contacting us at the address below. We will
              respond to verified requests within thirty (30) days.
            </p>
          </section>

          <section>
            <h2>6. Third-Party Links</h2>
            <p>
              Our site may contain links to third-party websites. We are not responsible
              for the privacy practices or content of those sites. We encourage you to
              review the privacy policies of any third-party site you visit.
            </p>
          </section>

          <section>
            <h2>7. Children&rsquo;s Privacy</h2>
            <p>
              This site is intended for business use and is not directed at individuals
              under 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2>8. Contact</h2>
            <p>
              For questions about this privacy policy or to exercise your data rights,
              contact JM Equipment Inc. at:
            </p>
            <address>
              JM Equipment Inc.<br />
              405 1/2 West Congress St<br />
              Sturgis, MI 49091<br />
              <a href="mailto:riley@jmequipment.net">riley@jmequipment.net</a><br />
              <a href="tel:(269) 659-0093">(269) 659-0093</a>
            </address>
          </section>

          <section>
            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Changes will be posted
              on this page with a revised date. Your continued use of the site after
              changes constitutes acceptance of the updated policy.
            </p>
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
