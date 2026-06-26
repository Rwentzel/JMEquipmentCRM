import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { catalog } from "@/data/catalog";
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
    "rollstand rebuild",
    "core splitter",
    "industrial parts",
    "Sturgis Michigan",
  ],
  authors: [{ name: "JM Equipment Inc." }],
  openGraph: {
    type: "website",
    siteName: "JM Equipment Parts Store",
    title: "JM Equipment — Industrial Parts Store",
    description: DESC,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "JM Equipment — Industrial Parts Store", description: DESC },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <OrgJsonLd />
      </body>
    </html>
  );
}
