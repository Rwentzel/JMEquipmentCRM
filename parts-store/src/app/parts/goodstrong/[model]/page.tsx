import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { goodstrongModels, findGoodstrongModel } from "@/data/goodstrong";
import { ManualIndex } from "@/components/machine/ManualIndex";

export function generateStaticParams() {
  return goodstrongModels.map((m) => ({ model: m.id }));
}

export function generateMetadata({ params }: { params: { model: string } }): Metadata {
  const model = findGoodstrongModel(params.model);
  if (!model) return { title: "Goodstrong sheeter — JM Equipment" };
  return {
    title: `${model.label} Parts & Manual`,
    description: `Manual sections, exploded-view diagrams, and parts ordering for the Goodstrong ${model.label} sheeter.`,
    robots: { index: false, follow: false },
  };
}

export default function GoodstrongModelPage({ params }: { params: { model: string } }) {
  const model = findGoodstrongModel(params.model);
  if (!model) notFound();
  return <ManualIndex model={model} />;
}
