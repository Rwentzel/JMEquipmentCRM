import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared header for every route outside the storefront. `children` is an
 * optional right-hand slot (the request-list count button on pages that have
 * a request list to count).
 */
export function PolicyNav({ children }: { children?: ReactNode }) {
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
          <Link href="/machines">Machines</Link>
          <Link href="/compare">Compare</Link>
        </div>
        {children}
      </div>
    </nav>
  );
}
