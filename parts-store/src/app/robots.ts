import type { MetadataRoute } from "next";
import { isLive } from "@/lib/launch";

/**
 * Crawling is gated by launch mode: set JME_LAUNCH=live in the production
 * environment to open the site to search engines (layout.tsx flips its
 * per-page robots metadata off the same switch). Anything else — including
 * every preview and sandbox — stays fully disallowed.
 *
 * Never crawlable, launch or not: the APIs, the two staff consoles, and the
 * tokenised customer quote links under /q/ — those documents carry a
 * customer's name, address and pricing, so a crawler that ever gets hold of
 * one (a shared email, a browser toolbar) must not fetch it.
 */
// Required for the static preview export (output: "export"); the result is
// identical either way — launch mode is a build-time switch.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  if (isLive()) {
    return {
      rules: { userAgent: "*", allow: "/", disallow: ["/ops", "/quotes", "/q/", "/api/"] },
      sitemap: "https://parts.jmequipment.net/sitemap.xml",
    };
  }
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
