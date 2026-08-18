/**
 * Quote Center loading state.
 *
 * Deliberately scoped to /quotes rather than the app root. A root loading.tsx
 * makes EVERY route stream, which commits a 200 before notFound() can run —
 * that turned every bad SKU, model or quote token into a soft 404 (200 with
 * "Page not found"), exactly what search engines penalise. The storefront is
 * prerendered and gains nothing from a skeleton; this route actually does the
 * work, serialising the whole quote store and the parts master, and it never
 * calls notFound().
 */
export default function Loading() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }} aria-busy="true" aria-label="Loading the Quote Center">
      <div style={{ background: "var(--ink-2)", borderRight: "1px solid #000" }} />
      <div style={{ background: "var(--canvas-tint)", padding: "34px 40px" }}>
        <div style={{ height: "150px", borderRadius: "var(--r-2)", background: "var(--jme-charcoal)", opacity: 0.35 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "14px", marginTop: "20px" }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ height: "108px", borderRadius: "var(--r-2)", background: "#fff", border: "1px solid var(--hairline)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
