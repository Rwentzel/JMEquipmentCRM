import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
}

/** JME SpecTable — dark-header, zebra-body table for parts / line items / comparison specs. */
export function SpecTable({
  columns = [],
  rows = [],
  children,
}: {
  columns?: Column[];
  rows?: Record<string, ReactNode>[];
  children?: ReactNode;
}) {
  return (
    <table className="jme-table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={cn(c.align === "right" && "r")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {children
          ? children
          : rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className={cn(c.align === "right" && "r")}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
      </tbody>
    </table>
  );
}
