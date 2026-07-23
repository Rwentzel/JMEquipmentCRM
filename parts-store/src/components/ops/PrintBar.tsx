"use client";

/** Screen-only toolbar above the printable quote document. */
export function PrintBar({ backHref }: { backHref: string }) {
  return (
    <div className="qd-bar">
      <a href={backHref}>← Back to ops desk</a>
      <span>Internal document — contains pricing. Do not share the link; print or save as PDF to send.</span>
      <button onClick={() => window.print()}>Print / Save PDF</button>
    </div>
  );
}
