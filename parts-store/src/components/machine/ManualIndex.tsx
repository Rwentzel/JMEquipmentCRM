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
            <p>
              Sections below follow the factory Part Catalogue&rsquo;s own index, with the catalogue&rsquo;s page
              numbers. Pick a section to view its parts and order from it.
            </p>
          </div>

          <Callout title="About this manual index">
            Serial matching: {model.serialPattern}. Sections marked &ldquo;Parts list pending&rdquo; are in the
            catalogue&rsquo;s index but their drawing pages haven&rsquo;t been digitized yet — call the parts desk and
            reference the page number shown.
          </Callout>

          <div className="gs-sectiongrid">
            {model.sections.map((s) => {
              const hasDiagram = Boolean(model.diagrams[s.id]?.length);
              const body = (
                <div className="jme-card__body">
                  <h3>{s.label}</h3>
                  <span className="jme-mono ps-fine">p. {s.pageLabel}</span>
                  {s.drawings && s.drawings.length > 0 && (
                    <span className="ps-fine gs-sectioncard__count">
                      {s.drawings.length} drawing{s.drawings.length !== 1 ? "s" : ""} in this section
                    </span>
                  )}
                  <div className="gs-sectioncard__foot">
                    {hasDiagram ? <Tag tone="green">View parts</Tag> : <Tag>Parts list pending</Tag>}
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
