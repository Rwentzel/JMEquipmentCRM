"use client";

import { useState } from "react";

export function SmartImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
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
      onError={() => setFailed(true)}
    />
  );
}
