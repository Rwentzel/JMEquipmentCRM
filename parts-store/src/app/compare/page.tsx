import type { Metadata } from "next";
import { catalog } from "@/data/catalog";
import { details } from "@/data/details";
import { toPublicMachine } from "@/data/sanitize";
import { CompareClient, type CompareRow } from "@/components/machine/CompareClient";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Compare Machines — JM Equipment",
  description: "Side-by-side comparison of JM Equipment converting machinery — specs, availability, and applications.",
  robots: pageRobots(),
};

export default function ComparePage() {
  // Build comparison rows on the server (public-safe fields only — no prices).
  const rows: CompareRow[] = catalog.machines.map(toPublicMachine).map((m) => {
    const d = details[m.sku];
    const specMap: Record<string, string> = {};
    m.specs.forEach((s) => (specMap[s.k] = s.v));
    return {
      sku: m.sku,
      name: m.name,
      family: m.family,
      statusBand: m.statusBand,
      tagLabel: m.tagLabel,
      tag: m.tag,
      action: m.action,
      spec1: m.specs[0]?.v ?? "—",
      spec2: m.specs[1]?.v ?? "—",
      power: specMap["Power"] ?? specMap["Speed"] ?? specMap["Web Width"] ?? "—",
      apps: d ? d.apps.slice(0, 3).join(", ") : "—",
    };
  });

  return <CompareClient rows={rows} />;
}
