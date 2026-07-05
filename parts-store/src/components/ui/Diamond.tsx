"use client";

import { useState } from "react";

/**
 * Branded diamond mark — the real JME logo (saved under /public/brand,
 * provided directly by JM Equipment). Cropped via CSS to isolate the diamond
 * from its source letterhead image. Falls back to a CSS-drawn lockup if the
 * image fails to load.
 */
export function Diamond({ size = 34 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="jme-mark" style={{ width: size, height: size, flexBasis: size }} aria-label="JME">
        <span>JME</span>
      </span>
    );
  }

  return (
    <span className="jme-mark jme-mark--photo" style={{ width: size, height: size, flexBasis: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/jme-logo-mark-source.jpg" alt="JME" onError={() => setFailed(true)} />
    </span>
  );
}
