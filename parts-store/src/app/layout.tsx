import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { catalog } from "@/data/catalog";
import { FAQ } from "@/data/faq";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const DESC =
  "Converting Machinery Solutions. Sheeters, rollstands, and the JME core splitter — built, rebuilt, and parts-supported in Sturgis, Michigan since 1989. Request a quote on machines and parts.";

export const metadata: Metadata = {
  metadataBase: new URL("https://parts.jmequipment.net"),
  title: {
    default: "JM Equipment — Industrial Parts Store",
    template: "%s · JM Equipment",
  },
  description: DESC,
  applicationName: "JM Equipment Parts Store",
  keywords: [
    "converting machinery",
    "paper converting parts",
    "sheeter parts",
    "Goodstrong sheeter parts",
    "Goodstrong 1600 parts",
    "Goodstrong 1600E parts",
    "Goodstrong 1650 parts",
    "rollstand rebuild",
    "Geo M. Martin rollstand parts",
    "core splitter",
    "hydraulic core splitter blades",
    "industrial parts",
    "converting machine downtime",
    "sheeter blade replacement",
    "Sturgis Michigan",
  ],
  authors: [{ name: "JM Equipment Inc." }],
  openGraph: {
    type: "website",
    siteName: "JM Equipment Parts Store",
    title: "JM Equipment — Industrial Parts Store",
    description: DESC,
    locale: "en_US",
    images: [{ url: "/images/og-card.png", width: 1200, height: 630, alt: "JM Equipment — Parts Store" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "JM Equipment — Industrial Parts Store",
    description: DESC,
    images: ["/images/og-card.png"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.json",
  // Sandbox: keep this build out of search indexes until launch is approved.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#141414",
  colorScheme: "dark",
};

/** Public LocalBusiness structured data — public contact info only. */
function OrgJsonLd() {
  const c = catalog.contact;
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: c.company,
    slogan: c.tagline,
    description: DESC,
    foundingDate: String(c.est),
    telephone: c.phone,
    email: c.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "405 1/2 West Congress St",
      addressLocality: "Sturgis",
      addressRegion: "MI",
      postalCode: "49091",
      addressCountry: "US",
    },
    areaServed: "US",
    knowsAbout: catalog.machines.map((m) => m.family).filter(Boolean),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

/** FAQPage structured data — drives rich-result eligibility once the site is indexable. */
function FaqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW === "1";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}>
      <body>
        {IS_PREVIEW && (
          <div
            style={{
              background: "#b8920a",
              color: "#141414",
              textAlign: "center",
              fontWeight: 700,
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              letterSpacing: "0.04em",
            }}
          >
            PRIVATE PREVIEW — for JM Equipment review only. Quote forms and the assistant are disabled in this
            preview; nothing here is live or indexed.
          </div>
        )}
        {children}
        <OrgJsonLd />
        <FaqJsonLd />
      </body>
    </html>
  );
}
