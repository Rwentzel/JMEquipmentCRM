import type { MetadataRoute } from "next";
import { isLive } from "@/lib/launch";

/**
 * Crawling is gated by launch mode: set JME_LAUNCH=live in the production
 * environment to open the site to search engines (layout.tsx flips its
 * per-page robots metadata off the same switch). Anything else — including
 * every preview and sandbox — stays fully disallowed. /ops and the APIs are
 * never crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  if (isLive()) {
    return {
      rules: { userAgent: "*", allow: "/", disallow: ["/ops", "/api/"] },
      sitemap: "https://parts.jmequipment.net/sitemap.xml",
    };
  }
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
