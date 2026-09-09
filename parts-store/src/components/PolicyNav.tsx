import { SiteNav } from "@/components/SiteNav";

export function PolicyNav() {
  return (
    <SiteNav
      links={[
        { label: "Parts Store", href: "/" },
        { label: "Machine Platform", href: "/machines" },
        { label: "Support", href: "/support" },
        { label: "Compare", href: "/compare" },
      ]}
    />
  );
}
