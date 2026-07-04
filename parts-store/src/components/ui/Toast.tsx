import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** JME Toast — condensed uppercase confirmation pill. */
export function Toast({
  tone = "red",
  icon,
  children,
}: {
  tone?: "red" | "gold" | "green";
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("jme-toast", tone === "gold" && "jme-toast--gold", tone === "green" && "jme-toast--green")}>
      {icon}
      {children}
    </div>
  );
}
