"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button, Diamond } from "@/components/ui";

export interface SiteNavLink {
  label: string;
  href: string;
  /** Marks the link as the page the visitor is on (rendered as text, not a link). */
  current?: boolean;
  /** Same-page anchors: the storefront scrolls instead of navigating. */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * The one site nav — brand, links, request-list button, burger. Every screen
 * uses this so the phone menu behaves the same everywhere: collapsed until
 * the burger opens it, closed again when a link is chosen.
 */
export function SiteNav({
  links,
  count = 0,
  requestHref = "/#request",
  onRequest,
  onBrand,
  className,
  children,
}: {
  links: SiteNavLink[];
  count?: number;
  requestHref?: string;
  /** Storefront override: scroll to the request section instead of navigating. */
  onRequest?: () => void;
  onBrand?: (e: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <nav className={"ps-nav" + (className ? ` ${className}` : "")} aria-label="Site">
      <div className="ps-nav__in">
        <Link className="brand" href="/" onClick={onBrand}>
          <Diamond size={30} />
          <span>
            <b>JM Equipment</b>
            <small>Converting Machinery Solutions</small>
          </span>
        </Link>
        <div id="site-nav-links" className={"ps-nav__links" + (open ? " open" : "")}>
          {links.map((l) =>
            l.current ? (
              <span key={l.label} aria-current="page">
                {l.label}
              </span>
            ) : l.onClick ? (
              <a
                key={l.label}
                href={l.href}
                onClick={(e) => {
                  close();
                  l.onClick?.(e);
                }}
              >
                {l.label}
              </a>
            ) : (
              <Link key={l.label} href={l.href} onClick={close}>
                {l.label}
              </Link>
            ),
          )}
          {children}
        </div>
        {onRequest ? (
          <Button
            size="sm"
            onClick={() => {
              close();
              onRequest();
            }}
          >
            Request List{count > 0 ? ` · ${count}` : ""}
          </Button>
        ) : (
          <Button size="sm" href={requestHref}>
            Request List{count > 0 ? ` · ${count}` : ""}
          </Button>
        )}
        <button
          type="button"
          className="ps-nav__burger"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="site-nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "≡"}
        </button>
      </div>
    </nav>
  );
}
