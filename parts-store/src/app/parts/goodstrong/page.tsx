import type { Metadata } from "next";
import { GoodstrongPicker } from "@/components/machine/GoodstrongPicker";
import { pageRobots } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Goodstrong Sheeter Parts & Manuals",
  description:
    "Find parts and manual sections for Goodstrong 1600, 1600-E, and 1650 sheeters. Look up your machine by serial number or model.",
  robots: pageRobots(),
};

export default function GoodstrongIndexPage() {
  return <GoodstrongPicker />;
}
