import { SiteNav } from "@/components/SiteNav";

export function PolicyNav() {
  return (
    <SiteNav
      links={[
        { label: "Parts Store", href: "/" },
        { label: "Machine Platform", href: "/machines" },
        { label: "Support", href: "/support" },
        { label: "How quoting works", href: "/how-quoting-works" },
        { label: "Compare", href: "/compare" },
      ]}
    />
  );
}
