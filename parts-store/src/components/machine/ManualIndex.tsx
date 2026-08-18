import { Callout, Eyebrow, Tag } from "@/components/ui";
import { goodstrongModels } from "@/data/goodstrong";
import { catalog } from "@/data/catalog";
import type { GoodstrongModel } from "@/data/types";

export function ManualIndex({ model }: { model: GoodstrongModel }) {
  // When the index was transcribed from a different machine's catalogue, its
  // page numbers are that book's. Telling a customer to quote them would send
  // the desk to the wrong drawing, so they are attributed, never presented as
  // "your manual, page 5-3".
  const sourceModel = model.sectionsFrom && model.sectionsFrom !== model.id
    ? goodstrongModels.find((m) => m.id === model.sectionsFrom)
    : undefined;

  return (
    <main className="gs-page">
      <section className="ps-sec">
        <div className="ps-wrap">
          <div className="ps-sechd">
            <div>
              <Eyebrow>Goodstrong sheeters</Eyebrow>
              <h1 className="jme-h2">{model.label} — parts &amp; manual</h1>
            </div>
            <p>
              {sourceModel ? (
                <>
                  We don&rsquo;t have this model&rsquo;s own Part Catalogue yet. The sections below are the{" "}
                  {sourceModel.label}{" "}
                  index, shown as a guide because the GMC-TC platform is laid out the same
                  way &mdash; the page numbers are that book&rsquo;s, not yours. Send your serial number and what
                  you&rsquo;re replacing and the desk will identify the part from your machine.
                </>
              ) : (
                <>
                  Sections below follow the factory Part Catalogue&rsquo;s own index, with the catalogue&rsquo;s
                  page numbers. Pick a section to view its parts and order from it.
                </>
              )}
            </p>
          </div>

          <Callout title="About this manual index">
            {sourceModel ? (
              <>
                Serial matching: {model.serialPattern}. Because these page numbers come from the{" "}
                {sourceModel.label} catalogue, please don&rsquo;t quote them as your own &mdash; call{" "}
                {catalog.contact.phone} or email {catalog.contact.email} with your serial number and a
                description or photo of the part, and the desk confirms fit in writing.
              </>
            ) : (
              <>
                Serial matching: {model.serialPattern}. Sections marked &ldquo;Parts list pending&rdquo; are in the
                catalogue&rsquo;s index but their drawing pages haven&rsquo;t been digitized yet — call the parts
                desk and reference the page number shown.
              </>
            )}
          </Callout>

          <div className="gs-sectiongrid">
            {model.sections.map((s) => {
              const hasDiagram = Boolean(model.diagrams[s.id]?.length);
              const body = (
                <div className="jme-card__body">
                  <h2>{s.label}</h2>
                  <span className="jme-mono ps-fine">
                    {sourceModel ? `${sourceModel.label} cat. p. ${s.pageLabel}` : `p. ${s.pageLabel}`}
                  </span>
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
    </main>
  );
}
