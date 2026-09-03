"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Read a query-string parameter without setState-in-effect: the URL is an
 * external store. Server snapshot is null (no URL on the server), so the
 * first client render matches the server markup and the real value arrives
 * on the post-hydration render.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function useUrlParam(name: string): string | null {
  const getSnapshot = useCallback(() => new URLSearchParams(window.location.search).get(name), [name]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
