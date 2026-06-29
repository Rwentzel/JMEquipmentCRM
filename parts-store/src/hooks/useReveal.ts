"use client";

import { useEffect } from "react";

/**
 * Adds `.in` to every `.ps-sec` as it enters the viewport (entrance animation).
 * Respects prefers-reduced-motion by revealing everything immediately.
 */
export function useReveal() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".ps-sec"));
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    sections.forEach((el) => el.classList.add("will-reveal"));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
