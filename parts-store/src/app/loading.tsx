export default function Loading() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center" }} aria-busy="true" aria-label="Loading">
      <div className="jme-eyebrow">Loading…</div>
    </main>
  );
}
