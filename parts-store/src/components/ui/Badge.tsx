import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BadgeStatus } from "@/data/types";

/** JME Badge — status dot + label for live availability / pass-fail state. */
export function Badge({
  status = "default",
  children,
  className = "",
}: {
  status?: BadgeStatus;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "jme-badge",
        status === "stock" && "jme-badge--stock",
        status === "lead" && "jme-badge--lead",
        status === "out" && "jme-badge--out",
        status === "info" && "jme-badge--info",
        className,
      )}
    >
      {children}
    </span>
  );
}
