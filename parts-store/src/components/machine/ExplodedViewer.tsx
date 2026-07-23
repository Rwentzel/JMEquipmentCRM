"use client";

import { useState } from "react";
import { Callout, Eyebrow, SmartImg, Tag, Toast } from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { asset } from "@/lib/utils";
import { PartsTable } from "./PartsTable";
import { QtyPickerModal } from "./QtyPickerModal";
import type { DiagramPage, DiagramPart, GoodstrongModel, ManualSection } from "@/data/types";

export function ExplodedViewer({
  model,
  section,
  pages,
}: {
  model: GoodstrongModel;
  section: ManualSection;
  pages: DiagramPage[];
}) {
  const [pageIdx, setPageIdx] = useState(0);
  const page = pages[pageIdx]!;
  const [activeBubble, setActiveBubble] = useState<number | null>(null);
  const [picking, setPicking] = useState<DiagramPart | null>(null);
  const { addWithQty } = useRequestList();
  const { message, show } = useToast();

  const locationCount = (bubble: number) => page.hotspots.filter((h) => h.bubble === bubble).length;

  function confirmAdd(qty: number) {
    if (!picking) return;
    addWithQty(
      { sku: picking.sku, name: picking.name, source: `${model.label} · ${section.label} · p.${page.pageLabel} · #${picking.bubble}` },
      qty,
    );
    show(`Added ${qty} × ${picking.sku} to your request`);
    setPicking(null);
  }

  return (
    <div className="gs-page">
      <section className="ps-sec">
        <div className="ps-wrap">
          <div className="ps-sechd">
            <div>
              <Eyebrow>
                {model.label} · {section.label}
              </Eyebrow>
              <h1 className="jme-h2">Exploded view</h1>
            </div>
            {pages.length > 1 && (
              <div className="gs-pager" role="group" aria-label="Diagram page">
                {pages.map((p, i) => (
                  <button
                    key={p.pageLabel}
                    className={"jme-btn jme-btn--ghost jme-btn--sm" + (i === pageIdx ? " gs-qtymodal__choice--on" : "")}
                    onClick={() => setPageIdx(i)}
                  >
                    p.{p.pageLabel}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Callout title="From the factory Part Catalogue">
            The parts list, locations, quantities, and page number on this page are transcribed from the machine&rsquo;s
            factory Part Catalogue. The drawing scan and callout positions are pending digitization — until then the
            image area is a placeholder, but every part below is real and orderable.
          </Callout>

          <div className="gs-explodedgrid">
            <div className="gs-diagram">
              <div className="gs-diagram__pagestamp jme-mono">PAGE {page.pageLabel}</div>
              <div className="gs-diagram__frame">
                <SmartImg src={asset(page.image)} alt={page.caption} className="gs-diagram__img" />
                {page.hotspots.map((h, i) => (
                  <button
                    key={`${h.bubble}-${i}`}
                    type="button"
                    className={"gs-bubble gs-bubble--pin" + (activeBubble === h.bubble ? " active" : "")}
                    style={{ left: `${h.x}%`, top: `${h.y}%` }}
                    onMouseEnter={() => setActiveBubble(h.bubble)}
                    onMouseLeave={() => setActiveBubble(null)}
                    onClick={() => {
                      const p = page.parts.find((pt) => pt.bubble === h.bubble);
                      if (p) setPicking(p);
                    }}
                    aria-label={`Part callout ${h.bubble}`}
                  >
                    {h.bubble}
                  </button>
                ))}
              </div>
              <p className="ps-fine">{page.caption}</p>
              <Tag>{section.label}</Tag>
            </div>

            <div className="gs-partscol">
              <PartsTable
                parts={page.parts}
                activeBubble={activeBubble}
                onHover={setActiveBubble}
                onSelect={(p) => setPicking(p)}
              />
            </div>
          </div>
        </div>
      </section>

      {picking && (
        <QtyPickerModal
          part={picking}
          locationCount={Math.max(1, locationCount(picking.bubble))}
          pageLabel={page.pageLabel}
          onConfirm={confirmAdd}
          onClose={() => setPicking(null)}
        />
      )}

      <div className={"ps-toastwrap" + (message ? " show" : "")} role="status" aria-live="polite">
        {message && <Toast tone="green">{message}</Toast>}
      </div>
    </div>
  );
}
