import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** JME Eyebrow — tiny all-caps kicker with a short red (or gold) rule. */
export function Eyebrow({
  tone = "red",
  children,
}: {
  tone?: "red" | "gold";
  children: ReactNode;
}) {
  return <div className={cn("jme-eyebrow", tone === "gold" && "gold")}>{children}</div>;
}
