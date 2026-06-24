"use client";

import { useState, type CSSProperties } from "react";

/**
 * Image that falls back to the branded placeholder if the source is missing.
 * Used because the sandbox ships no product photography (approved images only).
 */
export function SmartImg({
  src,
  alt,
  style,
  className,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const finalSrc = failed ? "/images/placeholder.svg" : src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
