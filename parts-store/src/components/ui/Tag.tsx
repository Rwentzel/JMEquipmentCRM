import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { TagTone } from "@/data/types";

/** JME Tag — small uppercase metadata chip with colored hairline border. */
export function Tag({
  tone = "default",
  solid = false,
  children,
  className = "",
}: {
  tone?: TagTone;
  solid?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "jme-tag",
        solid && "jme-tag--solid",
        tone === "consult" && "jme-tag--consult",
        tone === "blue" && "jme-tag--blue",
        tone === "red" && "jme-tag--red",
        tone === "green" && "jme-tag--green",
        className,
      )}
    >
      {children}
    </span>
  );
}
