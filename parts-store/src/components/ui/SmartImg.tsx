"use client";

import { useState } from "react";

/**
 * Every storefront image goes through here, so this is the one place that
 * decides how they load.
 *
 * Images are lazy by default: the home page carries ~600KB of machine photos
 * and almost all of them are below the fold, so loading them eagerly delays
 * the first screen for no benefit — on the rural connections a lot of this
 * customer base is on, that is the difference between a fast page and a slow
 * one. Pass `priority` for an image that is actually visible on load (a hero);
 * it then loads eagerly and at high fetch priority so it is not queued behind
 * the lazy ones.
 */
export function SmartImg({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Above the fold on first paint — load eagerly instead of lazily. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const finalSrc = failed ? "/images/placeholder.svg" : src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
