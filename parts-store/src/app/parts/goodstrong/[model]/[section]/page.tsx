import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { goodstrongModels, findGoodstrongModel } from "@/data/goodstrong";
import { ExplodedViewer } from "@/components/machine/ExplodedViewer";
import { pageRobots } from "@/lib/launch";

export function generateStaticParams() {
  return goodstrongModels.flatMap((m) =>
    Object.keys(m.diagrams).map((section) => ({ model: m.id, section })),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ model: string; section: string }> }): Promise<Metadata> {
  const { model: modelId, section: sectionId } = await params;
  const model = findGoodstrongModel(modelId);
  const section = model?.sections.find((s) => s.id === sectionId);
  if (!model || !section) return { title: "Goodstrong sheeter — JM Equipment" };
  return {
    title: `${model.label} ${section.label} — Exploded View`,
    description: `Exploded-view diagram and parts list for the ${section.label} area of the Goodstrong ${model.label} sheeter.`,
    robots: pageRobots(),
  };
}

export default async function GoodstrongSectionPage({ params }: { params: Promise<{ model: string; section: string }> }) {
  const { model: modelId, section: sectionId } = await params;
  const model = findGoodstrongModel(modelId);
  const section = model?.sections.find((s) => s.id === sectionId);
  const pages = model?.diagrams[sectionId];
  if (!model || !section || !pages || pages.length === 0) notFound();
  return <ExplodedViewer model={model} section={section} pages={pages} />;
}
