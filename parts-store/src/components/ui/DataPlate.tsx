import type { ReactNode } from "react";
import type { SpecRow } from "@/data/types";

type Row = SpecRow | { label: string; value: string };

function rowParts(r: Row): { k: string; v: string } {
  if ("k" in r) return { k: r.k, v: r.v };
  return { k: r.label, v: r.value };
}

/** JME DataPlate — engraved machine ID plate with corner rivets and dotted spec rows. */
export function DataPlate({
  title,
  sku,
  rows = [],
  children,
}: {
  title?: string;
  sku?: string;
  rows?: Row[];
  children?: ReactNode;
}) {
  return (
    <div className="jme-plate">
      <span className="jme-plate__rivets" aria-hidden />
      {(title || sku) && (
        <div className="jme-plate__hd">
          <h4>{title}</h4>
          {sku && <span className="jme-plate__sku">{sku}</span>}
        </div>
      )}
      <div className="jme-plate__rows">
        {children
          ? children
          : rows.map((r) => {
              const { k, v } = rowParts(r);
              return (
                <div className="jme-plate__row" key={k}>
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              );
            })}
      </div>
    </div>
  );
}
