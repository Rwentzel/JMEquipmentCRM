/* eslint-disable @next/next/no-img-element */
import { asset } from "@/lib/utils";

/**
 * Branded diamond mark — the real JME diamond-cut logo (chrome lettering on
 * the red diamond). Rendered as a plain <img> from /public; falls back to the
 * CSS lockup only if the asset ever fails to load.
 */
export function Diamond({ size = 34 }: { size?: number }) {
  return (
    <img
      src={asset("jme-diamond-cut.png")}
      alt="JME"
      width={size}
      height={Math.round(size * 1.02)}
      style={{ display: "block", width: size, height: "auto", flexShrink: 0 }}
    />
  );
}
