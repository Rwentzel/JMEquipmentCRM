import type { Metadata } from "next";

/** Internal ops desk — never indexed, never linked from public pages. */
export const metadata: Metadata = {
  title: "Ops Desk",
  robots: { index: false, follow: false },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
