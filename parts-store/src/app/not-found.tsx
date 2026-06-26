import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "var(--s-12) var(--wrap-pad)",
      }}
    >
      <div>
        <div className="jme-eyebrow" style={{ justifyContent: "center", marginBottom: "var(--s-4)" }}>
          Error 404
        </div>
        <h1 className="jme-h2" style={{ marginBottom: "var(--s-3)" }}>
          Page not found
        </h1>
        <p style={{ color: "var(--paper-dim)", marginBottom: "var(--s-6)" }}>
          That page isn&apos;t here. The part or machine may have moved.
        </p>
        <Link className="jme-btn" href="/">
          Back to the parts store
        </Link>
      </div>
    </main>
  );
}
