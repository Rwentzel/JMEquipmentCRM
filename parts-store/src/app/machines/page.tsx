import type { Metadata } from "next";
import { Suspense } from "react";
import { catalog } from "@/data/catalog";
import { toPublicMachine, toPublicPart } from "@/data/sanitize";
import { PlatformClient } from "@/components/machine/PlatformClient";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Machine Platform — Parts by Machine — JM Equipment",
  description:
    "Pick the machine you're working on and see only the parts JM Equipment publishes as fitting it. Every line is quote-required; fitment, lead time, and freight are confirmed in writing.",
  robots: pageRobots(),
  alternates: { canonical: "/machines" },
};

export default function MachinesPage() {
  // Public-safe projections only (no price, cost, vendor, bin, or quantity
  // fields exist on these types; the sanitizers strip anything that drifts in).
  const machines = catalog.machines.map(toPublicMachine);
  // Only curated parts carry a published fitment; the generated web references
  // never match a machine, so they need not travel to the client here.
  const parts = catalog.parts.filter((p) => p.fitment).map(toPublicPart);
  return (
    <Suspense fallback={null}>
      <PlatformClient machines={machines} parts={parts} />
    </Suspense>
  );
}
