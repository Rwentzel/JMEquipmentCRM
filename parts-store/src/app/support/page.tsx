import type { Metadata } from "next";
import { SupportHubClient } from "@/components/support/SupportHubClient";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Support & Resources",
  description:
    "Troubleshooting, manuals, field service, fitment checks and parts diagrams for Goodstrong, Martin and JME converting equipment. Every request reaches the parts desk in Sturgis and gets a written reply.",
  robots: pageRobots(),
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return <SupportHubClient />;
}
