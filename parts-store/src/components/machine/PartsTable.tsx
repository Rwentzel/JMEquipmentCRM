"use client";

import type { DiagramPart } from "@/data/types";

export function PartsTable({
  parts,
  activeBubble,
  onHover,
  onSelect,
}: {
  parts: DiagramPart[];
  activeBubble: number | null;
  onHover: (bubble: number | null) => void;
  onSelect: (part: DiagramPart) => void;
}) {
  // Group rows sharing the same bubble number so each part appears once
  // even when it shows up at several locations in the drawing.
  const byBubble = new Map<number, DiagramPart>();
  for (const p of parts) byBubble.set(p.bubble, p);
  const rows = [...byBubble.values()].sort((a, b) => a.bubble - b.bubble);
  const locationCount = (bubble: number) => parts.filter((p) => p.bubble === bubble).length;

  return (
    <div className="gs-partstable" role="table" aria-label="Parts list">
      <div className="gs-partstable__row gs-partstable__row--head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Part #</span>
        <span role="columnheader">Description</span>
        <span role="columnheader">Qty</span>
      </div>
      {rows.map((p) => {
        const locs = locationCount(p.bubble);
        return (
          <button
            key={p.bubble}
            type="button"
            role="row"
            className={"gs-partstable__row" + (activeBubble === p.bubble ? " active" : "")}
            onMouseEnter={() => onHover(p.bubble)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(p.bubble)}
            onClick={() => onSelect(p)}
          >
            <span className="gs-bubble gs-bubble--sm" role="cell">
              {p.bubble}
            </span>
            <span className="jme-mono" role="cell">
              {p.sku}
            </span>
            <span role="cell">
              {p.name}
              {locs > 1 && <em className="gs-partstable__locs"> · {locs} locations on this page</em>}
              {p.alsoKnownAs && p.alsoKnownAs.length > 0 && (
                <em className="gs-partstable__aka"> · also listed as {p.alsoKnownAs.join(", ")}</em>
              )}
            </span>
            <span role="cell">{p.qty}</span>
          </button>
        );
      })}
    </div>
  );
}
