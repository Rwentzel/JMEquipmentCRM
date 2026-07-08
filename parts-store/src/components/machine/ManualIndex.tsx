import { Callout, Eyebrow, Tag } from "@/components/ui";
import type { GoodstrongModel } from "@/data/types";

export function ManualIndex({ model }: { model: GoodstrongModel }) {
  return (
    <div className="gs-page">
      <section className="ps-sec">
        <div className="ps-wrap">
          <div className="ps-sechd">
            <div>
              <Eyebrow>Goodstrong sheeters</Eyebrow>
              <h1 className="jme-h2">{model.label} — parts &amp; manual</h1>
            </div>
            <p>Pick a section below to view its exploded-view diagram and order parts directly from it.</p>
          </div>

          <Callout title="About this manual index">
            Serial format: {model.serialPattern}. Section page numbers below come from the manual&rsquo;s table of
            contents; sections marked &ldquo;Coming soon&rdquo; are waiting on the real manual content for that area.
          </Callout>

          <div className="gs-sectiongrid">
            {model.sections.map((s) => {
              const hasDiagram = Boolean(model.diagrams[s.id]?.length);
              const body = (
                <div className="jme-card__body">
                  <h3>{s.label}</h3>
                  <span className="jme-mono ps-fine">
                    pp. {s.startPage}–{s.endPage}
                  </span>
                  <div className="gs-sectioncard__foot">
                    {hasDiagram ? <Tag tone="green">View diagram</Tag> : <Tag>Coming soon</Tag>}
                  </div>
                </div>
              );
              return hasDiagram ? (
                <a key={s.id} className="jme-card gs-sectioncard" href={`/parts/goodstrong/${model.id}/${s.id}`}>
                  {body}
                </a>
              ) : (
                <div key={s.id} className="jme-card gs-sectioncard gs-sectioncard--soon" aria-disabled>
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
