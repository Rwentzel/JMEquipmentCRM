import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { catalog } from "@/data/catalog";
import { details } from "@/data/details";
import { toPublicMachine, toPublicPart } from "@/data/sanitize";
import { MachineDetailClient } from "@/components/machine/MachineDetailClient";
import { pageRobots } from "@/lib/launch";

export function generateStaticParams() {
  return catalog.machines.map((m) => ({ sku: m.sku }));
}

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  const { sku } = await params;
  const machine = catalog.machines.find((m) => m.sku === sku);
  if (!machine) return { title: "Machine — JM Equipment" };
  return {
    title: `${machine.name} — JM Equipment`,
    description: machine.blurb,
    robots: pageRobots(),
  };
}

/**
 * Product structured data. No `offers` block — this is RFQ-first with no
 * public price, and an Offer without a price/priceCurrency is invalid
 * structured data (see DATA_BOUNDARIES.md).
 */
function ProductJsonLd({ machine }: { machine: ReturnType<typeof toPublicMachine> }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: machine.name,
    description: machine.blurb,
    category: machine.family,
    brand: { "@type": "Brand", name: "JM Equipment" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default async function MachinePage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const rawMachine = catalog.machines.find((m) => m.sku === sku);
  const detail = details[sku];
  if (!rawMachine || !detail) notFound();

  const machine = toPublicMachine(rawMachine);
  const relatedParts = catalog.parts.filter((p) => p.cat === detail.partsCat).slice(0, 8).map(toPublicPart);

  return (
    <>
      <MachineDetailClient machine={machine} detail={detail} relatedParts={relatedParts} />
      <ProductJsonLd machine={machine} />
    </>
  );
}
