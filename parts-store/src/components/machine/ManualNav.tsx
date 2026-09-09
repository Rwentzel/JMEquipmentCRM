"use client";

import { SiteNav } from "@/components/SiteNav";
import { useRequestList } from "@/hooks/useRequestList";

/** The site nav for the Goodstrong manual screens, with the live request-list count. */
export function ManualNav() {
  const { count } = useRequestList();
  return (
    <SiteNav
      count={count}
      links={[
        { label: "Catalog", href: "/#parts" },
        { label: "Machine Platform", href: "/machines" },
        { label: "Manuals", href: "/parts/goodstrong", current: true },
        { label: "Support", href: "/support" },
        { label: "How quoting works", href: "/how-quoting-works" },
      ]}
    />
  );
}
