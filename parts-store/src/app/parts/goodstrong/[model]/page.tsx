import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { goodstrongModels, findGoodstrongModel } from "@/data/goodstrong";
import { ManualIndex } from "@/components/machine/ManualIndex";
import { pageRobots } from "@/lib/launch";

export function generateStaticParams() {
  return goodstrongModels.map((m) => ({ model: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ model: string }> }): Promise<Metadata> {
  const model = findGoodstrongModel((await params).model);
  if (!model) return { title: "Goodstrong sheeter — JM Equipment" };
  return {
    title: `${model.label} Parts & Manual`,
    description: `Manual sections, exploded-view diagrams, and parts ordering for the Goodstrong ${model.label} sheeter.`,
    robots: pageRobots(),
  };
}

export default async function GoodstrongModelPage({ params }: { params: Promise<{ model: string }> }) {
  const model = findGoodstrongModel((await params).model);
  if (!model) notFound();
  return <ManualIndex model={model} />;
}
