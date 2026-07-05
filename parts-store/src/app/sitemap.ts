import type { MetadataRoute } from "next";
import { catalog } from "@/data/catalog";
import { goodstrongModels } from "@/data/goodstrong";

/**
 * Sitemap groundwork — harmless to ship while the site stays gated
 * (robots.ts disallows all crawling; layout.tsx sets robots: {index:false}).
 * Flip those two switches at launch and this file needs no changes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://parts.jmequipment.net";
  const staticRoutes = ["", "/compare", "/freight", "/terms", "/privacy", "/parts/goodstrong"];
  const machineRoutes = catalog.machines.map((m) => `/machine/${m.sku}`);
  const goodstrongRoutes = goodstrongModels.flatMap((m) => [
    `/parts/goodstrong/${m.id}`,
    ...Object.keys(m.diagrams).map((section) => `/parts/goodstrong/${m.id}/${section}`),
  ]);

  return [...staticRoutes, ...machineRoutes, ...goodstrongRoutes].map((path) => ({
    url: base + path,
    lastModified: new Date(0),
  }));
}
