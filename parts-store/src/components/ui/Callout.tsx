import type { ReactNode } from "react";

/** JME Callout — gray panel with maroon left rule. ROI notes, "why JM", risk callouts. */
export function Callout({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="jme-callout">
      {title && <div className="jme-callout__title">{title}</div>}
      {children}
    </div>
  );
}
