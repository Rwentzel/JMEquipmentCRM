import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** JME Card — raised surface with optional header. Use `.on-light` for white canvases. */
export function Card({
  title,
  action,
  children,
  bodyClassName = "",
  className = "",
  ...rest
}: {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("jme-card", className)} {...rest}>
      {(title || action) && (
        <div className="jme-card__hd">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div className={cn("jme-card__body", bodyClassName)}>{children}</div>
    </div>
  );
}
