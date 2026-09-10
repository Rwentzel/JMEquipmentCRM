import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportHubClient } from "@/components/support/SupportHubClient";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Support & Resources — JM Equipment",
  description:
    "Troubleshooting, manuals, field service, fitment confirmation, parts diagrams and sales — every request reaches the JM Equipment parts desk in Sturgis, Michigan, with a reference number and a reply from a person.",
  robots: pageRobots(),
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportHubClient />
    </Suspense>
  );
}
