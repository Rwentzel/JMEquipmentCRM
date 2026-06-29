import Link from "next/link";

export function PolicyNav() {
  return (
    <nav className="ps-nav">
      <div className="ps-nav__in">
        <Link className="brand" href="/">
          <span className="jme-diamond-bullet ps-nav__mark" />
          <span>
            <b>JM Equipment</b>
            <small>Converting Machinery Solutions</small>
          </span>
        </Link>
        <div className="ps-nav__links">
          <Link href="/">Parts Store</Link>
          <Link href="/compare">Compare</Link>
        </div>
      </div>
    </nav>
  );
}
