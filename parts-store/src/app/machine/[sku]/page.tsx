import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { catalog } from "@/data/catalog";
import { details } from "@/data/details";
import { toPublicMachine, toPublicPart } from "@/data/sanitize";
import { MachineDetailClient } from "@/components/machine/MachineDetailClient";

export function generateStaticParams() {
  return catalog.machines.map((m) => ({ sku: m.sku }));
}

export function generateMetadata({ params }: { params: { sku: string } }): Metadata {
  const machine = catalog.machines.find((m) => m.sku === params.sku);
  if (!machine) return { title: "Machine — JM Equipment" };
  return {
    title: `${machine.name} — JM Equipment`,
    description: machine.blurb,
    robots: { index: false, follow: false },
  };
}

export default function MachinePage({ params }: { params: { sku: string } }) {
  const rawMachine = catalog.machines.find((m) => m.sku === params.sku);
  const detail = details[params.sku];
  if (!rawMachine || !detail) notFound();

  const machine = toPublicMachine(rawMachine);
  const relatedParts = catalog.parts.filter((p) => p.cat === detail.partsCat).slice(0, 8).map(toPublicPart);

  return <MachineDetailClient machine={machine} detail={detail} relatedParts={relatedParts} />;
}
