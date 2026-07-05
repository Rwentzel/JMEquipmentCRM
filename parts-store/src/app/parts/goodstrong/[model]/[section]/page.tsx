import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { goodstrongModels, findGoodstrongModel } from "@/data/goodstrong";
import { ExplodedViewer } from "@/components/machine/ExplodedViewer";

export function generateStaticParams() {
  return goodstrongModels.flatMap((m) =>
    Object.keys(m.diagrams).map((section) => ({ model: m.id, section })),
  );
}

export function generateMetadata({ params }: { params: { model: string; section: string } }): Metadata {
  const model = findGoodstrongModel(params.model);
  const section = model?.sections.find((s) => s.id === params.section);
  if (!model || !section) return { title: "Goodstrong sheeter — JM Equipment" };
  return {
    title: `${model.label} ${section.label} — Exploded View`,
    description: `Exploded-view diagram and parts list for the ${section.label} area of the Goodstrong ${model.label} sheeter.`,
    robots: { index: false, follow: false },
  };
}

export default function GoodstrongSectionPage({ params }: { params: { model: string; section: string } }) {
  const model = findGoodstrongModel(params.model);
  const section = model?.sections.find((s) => s.id === params.section);
  const pages = model?.diagrams[params.section];
  if (!model || !section || !pages || pages.length === 0) notFound();
  return <ExplodedViewer model={model} section={section} pages={pages} />;
}
