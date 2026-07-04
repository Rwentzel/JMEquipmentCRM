import { cn } from "@/lib/utils";
import type { BadgeStatus, StatusBand as Band } from "@/data/types";

/** Map a public status band to its badge color. */
const BAND_COLOR: Record<Band, BadgeStatus> = {
  "In Stock": "stock",
  "Limited Stock": "lead",
  Backorder: "lead",
  "Call for Availability": "info",
  "Quote Required": "default",
  "Freight Quote Required": "info",
  "Discontinued / Contact JM": "out",
};

/**
 * Renders one of the 7 allowed public availability bands. This is the ONLY
 * way availability is shown publicly — never an exact quantity. See
 * DATA_BOUNDARIES.md.
 */
export function StatusBand({ band, className = "" }: { band: Band; className?: string }) {
  const color = BAND_COLOR[band] ?? "default";
  return (
    <span
      className={cn(
        "jme-badge",
        color === "stock" && "jme-badge--stock",
        color === "lead" && "jme-badge--lead",
        color === "out" && "jme-badge--out",
        color === "info" && "jme-badge--info",
        className,
      )}
    >
      {band}
    </span>
  );
}
