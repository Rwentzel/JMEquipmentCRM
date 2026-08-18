/**
 * The storefront configurator's choices, as text and as a judgement about the
 * build they describe.
 *
 * Both the intake route (which records what the customer picked) and the quote
 * conversion (which decides whether the Quote Center's catalogue entry actually
 * describes that build) go through here, so the two cannot disagree about what
 * a configuration line looks like.
 */
import { details } from "@/data/details";

/**
 * Render the customer's chosen option SKUs as the lines stored on the RFQ:
 * `"Power: 5 HP / 460V 3Ø"`. Anything not an option of this machine is ignored
 * — the SKUs arrive from the browser.
 */
export function configLines(machineSku: string, chosen: Iterable<string>): string[] {
  const opts = details[machineSku]?.options ?? [];
  if (opts.length === 0) return [];
  const wanted = new Set(chosen);
  const lines: string[] = [];
  for (const opt of opts) {
    const picked = opt.choices.filter((c) => wanted.has(c.sku));
    if (picked.length > 0) lines.push(`${opt.label}: ${picked.map((c) => c.v).join(", ")}`);
  }
  return lines;
}

/**
 * Does this request describe the machine exactly as the Quote Center holds it?
 *
 * A Quote Center catalogue entry states one build — subtitle `12" Head · 75"
 * Frame`, spec `Power: 5 HP / 230V / 1PH`. Heading a quotation with it when the
 * customer asked for 460V and a 90-inch frame puts a spec table on the document
 * that contradicts the line item printed directly beneath it. That is worse
 * than a wrong document title: it reads as correct, and the customer signs it.
 *
 * Only the radio choices are compared. Add-on checkboxes (spare blades,
 * crating) are line additions and contradict nothing the catalogue entry says.
 *
 * An option with no choice marked "Standard" cannot be judged, so it counts as
 * a departure: the rep picks the machine rather than the desk guessing.
 */
export function isStandardBuild(machineSku: string, config: readonly string[] | undefined): boolean {
  const opts = (details[machineSku]?.options ?? []).filter((o) => o.type === "radio");
  if (opts.length === 0) return true;
  const lines = config ?? [];

  return opts.every((opt) => {
    const line = lines.find((l) => l.startsWith(`${opt.label}: `));
    // Not constrained by the request at all — nothing to contradict.
    if (!line) return true;
    const standard = opt.choices.find((c) => c.note === "Standard");
    if (!standard) return false;
    return line === `${opt.label}: ${standard.v}`;
  });
}
