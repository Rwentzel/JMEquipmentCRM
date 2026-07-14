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
