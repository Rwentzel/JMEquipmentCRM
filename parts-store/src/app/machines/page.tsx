import type { Metadata } from "next";
import { catalog } from "@/data/catalog";
import { toPublicMachine } from "@/data/sanitize";
import { MachinePlatformClient, type PlatformMachine } from "@/components/machine/MachinePlatformClient";
import { familyByPrefix, partsForMachine } from "@/lib/machineParts";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Machine Platform — JM Equipment",
  description:
    "Pick the machine you run and see only the parts that fit it. Nine published lines; every other machine is handled from the serial on its data plate.",
  robots: pageRobots(),
  alternates: { canonical: "/machines" },
};

/**
 * One page per machine line, chosen from a rail, with the parts that fit it.
 * Built on the server so the fitment decision and the public-safe projection
 * both happen before anything reaches the browser.
 */
export default function MachinesPage() {
  const machines: PlatformMachine[] = catalog.machines.map((m) => ({
    machine: toPublicMachine(m),
    parts: partsForMachine(m.sku),
  }));
  return <MachinePlatformClient machines={machines} prefixes={familyByPrefix()} />;
}
