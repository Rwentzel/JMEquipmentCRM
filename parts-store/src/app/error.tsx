"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div className="jme-eyebrow" style={{ marginBottom: 16 }}>Something went wrong</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--t-xl)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "var(--track-display)", marginBottom: 12 }}>
          Unexpected Error
        </h1>
        <p style={{ color: "var(--paper-dim)", marginBottom: 24 }}>
          We hit a problem loading this page. Try again, or call the parts desk at{" "}
          <a href="tel:(269) 659-0093" style={{ color: "var(--jme-gold)" }}>(269) 659-0093</a>.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "10px 28px",
            background: "var(--grad-red-btn)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--r-1)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--t-base)",
            textTransform: "uppercase",
            letterSpacing: "var(--track-heading)",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
