export default function Loading() {
  return (
    <main className="ps-skeleton" aria-busy="true" aria-label="Loading">
      {/* Nav placeholder */}
      <div className="ps-skeleton__bar" />
      {/* Hero */}
      <div className="ps-skeleton__hero">
        <div>
          <div className="ps-skeleton__line" style={{ width: 120, height: 10 }} />
          <div className="ps-skeleton__line" style={{ width: "80%", height: 28, marginTop: 12 }} />
          <div className="ps-skeleton__line" style={{ width: "60%", height: 14, marginTop: 10 }} />
          <div className="ps-skeleton__line" style={{ width: "90%", height: 14, marginTop: 6 }} />
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <div className="ps-skeleton__line" style={{ width: 140, height: 42, borderRadius: "var(--r-1)" }} />
            <div className="ps-skeleton__line" style={{ width: 120, height: 42, borderRadius: "var(--r-1)" }} />
          </div>
        </div>
        <div className="ps-skeleton__img" />
      </div>
      {/* Grid */}
      <div className="ps-skeleton__grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="ps-skeleton__card" />
        ))}
      </div>
    </main>
  );
}
