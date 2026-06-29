import Link from "next/link";

export default function NotFound() {
  return (
    <main className="ps-404">
      <div>
        <div className="jme-eyebrow">Error 404</div>
        <h1 className="jme-h2">Page not found</h1>
        <p className="ps-404__p">
          That page isn&apos;t here. The part or machine may have moved.
        </p>
        <Link className="jme-btn" href="/">
          Back to the parts store
        </Link>
      </div>
    </main>
  );
}
