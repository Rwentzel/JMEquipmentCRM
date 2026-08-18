/**
 * Launch mode — the single go-live switch.
 *
 * `JME_LAUNCH=live` (set only in the approved production environment) opens
 * the site to search engines: robots.ts allows crawling and layout.tsx drops
 * its noindex metadata. Every other value — or the variable being absent —
 * keeps the site fully gated, so previews and sandboxes can never be indexed
 * by accident. See LAUNCH.md for the full go-live runbook.
 */
export function isLive(): boolean {
  return process.env.JME_LAUNCH === "live";
}

/**
 * Robots metadata for PUBLIC pages: index only when live. Per-page `robots`
 * overrides the root layout's, so every public page must use this — a
 * hardcoded `{ index: false }` would keep that page hidden even at launch.
 * Internal surfaces (/ops) keep a hardcoded noindex and never use this.
 */
export function pageRobots(): { index: boolean; follow: boolean } {
  const live = isLive();
  return { index: live, follow: live };
}

/**
 * Absolute base URL for links that leave the browser — desk emails, mainly,
 * where a relative "/ops" is not clickable and tells nobody which deployment
 * it belongs to.
 *
 * `JME_PUBLIC_URL` overrides it for staging or a different domain. The default
 * matches the canonical host already used by the sitemap, robots, and
 * metadataBase; those three still hardcode it, and folding them onto this
 * helper is worth doing when nobody else is mid-edit in those files.
 */
export function siteUrl(): string {
  return (process.env.JME_PUBLIC_URL || "https://parts.jmequipment.net").replace(/\/+$/, "");
}
