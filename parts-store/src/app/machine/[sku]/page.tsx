import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { catalog } from "@/data/catalog";
import { details } from "@/data/details";
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
  const machine = catalog.machines.find((m) => m.sku === params.sku);
  const detail = details[params.sku];
  if (!machine || !detail) notFound();

  const relatedParts = catalog.parts.filter((p) => p.cat === detail.partsCat);

  return <MachineDetailClient machine={machine} detail={detail} relatedParts={relatedParts} />;
}
