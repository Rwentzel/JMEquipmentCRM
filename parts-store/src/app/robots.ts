import type { MetadataRoute } from "next";

/**
 * Sandbox: disallow all crawling. The store must not be indexed until launch is
 * approved. Flip this (and the per-page `robots` metadata) only at launch.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
