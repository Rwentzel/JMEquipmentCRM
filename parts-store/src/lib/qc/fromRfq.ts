/**
 * Turn a storefront request into a draft quote.
 *
 * Lives here rather than inside the route so it can be exercised directly. The
 * previous test mirrored this mapping in a local helper, which is how a fix can
 * pass its unit tests and still be inert in the running app — the helper and
 * the route drift apart and only the helper is ever checked.
 *
 * The RFQ already carries everything a quote needs to start: who asked, how to
 * reach them, where it ships, and which SKUs at what quantity. Without this the
 * rep retypes all of it, which is both slow and how transcription errors reach
 * a customer-facing document.
 */
import { blankQuote } from "./logic";
import { UNMAPPED, resolveQcMachine } from "./machineFromRfq";
import { PARTS_MASTER } from "./partsMaster";
import { catalog } from "@/data/catalog";
import { isStandardBuild } from "../rfqConfig";
import type { QcMachine, QcQuote, QcQuotePart, QcSettings, QcSpec } from "./types";
import type { StoredRfq, StoredRfqItem } from "../rfqStore";

/**
 * The configurator lines as spec rows: "Power: 5 HP / 460V 3Ø" becomes
 * { k: "Power", v: "5 HP / 460V 3Ø" }. A line without a separator keeps its
 * whole text as the value rather than being dropped.
 */
function buildSpecs(config: string[] | undefined): QcSpec[] {
  return (config ?? []).map((line) => {
    const at = line.indexOf(": ");
    return at < 0 ? { k: "Configuration", v: line } : { k: line.slice(0, at), v: line.slice(at + 2) };
  });
}

/** Is this SKU one of the storefront's machines rather than a part? */
function storefrontMachine(sku: string) {
  return catalog.machines.find((m) => m.sku === sku);
}

export function quoteFromRfq(
  rfq: StoredRfq,
  qcCatalog: QcMachine[],
  settings: QcSettings,
  existingCount: number,
): QcQuote {
  const q = blankQuote(null, qcCatalog, settings, existingCount);

  // The storefront request list holds machines as well as parts: the machine
  // detail page adds a configured machine to the very same list. Treating every
  // request as parts headed the customer's document "Parts Quotation /
  // Replacement Parts & Components", with parts-desk specs, a "Genuine"
  // warranty and a "Same-Day" lead time — on a configured core splitter.
  const machineLines = rfq.items.filter((it) => storefrontMachine(it.sku));
  const lead: StoredRfqItem | undefined = machineLines[0];
  const machine: QcMachine | null = lead ? resolveQcMachine(lead.sku, qcCatalog) : null;

  // What the customer actually asked for, carried in its own right.
  //
  // With a Quote Center entry attached it overrides the catalogue's account of
  // the build, which describes one configuration and would otherwise print a
  // spec table contradicting the line beneath it. With no entry attached it is
  // all the document has — and without it the quote headed itself "Parts
  // Quotation / Replacement Parts & Components" for a machine.
  if (lead) {
    const sf = storefrontMachine(lead.sku)!;
    if (!machine || !isStandardBuild(lead.sku, lead.config)) {
      const chosen = buildSpecs(lead.config);
      // A machine taken as it comes still needs a spec block; without one the
      // document names the machine and then says nothing about it.
      q.rfqBuild = { sku: sf.sku, name: sf.name, desc: sf.blurb, specs: chosen.length ? chosen : sf.specs };
    }
  }

  q.machineId = machine ? machine.id : null;
  // Adopt the machine's commercial terms but NOT its price. blankQuote's base
  // is the default build's, and the customer configured something else: a
  // document quoting the standard 230V/75-inch splitter's price to someone who
  // asked for 460V and 90 inches is worse than one reading "By Consultation"
  // until the rep prices what was actually requested.
  q.base = 0;
  q.crating = 0;
  if (machine) {
    q.lead = machine.lead;
    q.warranty = machine.warranty;
    q.payment = machine.payment;
    q.tariffPct = machine.isImport ? settings.tariff || 0 : 0;
    // ROI is computed against the total. With nothing priced it renders a
    // 0-month payback and a five-year net equal to the gross saving, which
    // reads as a guarantee. The rep turns it on once there is a price.
    q.roiOn = false;
  }
  else {
    // blankQuote seeds these from its fallback machine, so a request for four
    // blades came back promising a 1-year warranty and a 10–12 week lead time.
    // Blank lets the document state the terms that actually apply.
    q.lead = "";
    q.warranty = "";
    q.tariffPct = 0;
    q.roiOn = false;
  }
  // blankQuote derives cost from its fallback machine's base, so an untouched
  // request reached the desk showing a −$12,600 margin against a quote that has
  // no price on it at all.
  q.cost = 0;

  q.rfqRef = rfq.ref;

  const c = rfq.contact;
  q.clientCompany = c.company || "";
  q.clientContact = [c.name, c.lastName].filter(Boolean).join(" ");
  q.clientEmail = c.email || "";
  q.clientCity = c.shipAddress || "";

  q.parts = rfq.items
    .map((it): QcQuotePart | null => {
      const master = PARTS_MASTER.find((p) => p.sku === it.sku);
      const price = master && master.price > 0 ? master.price : 0;
      // Fall back to the catalogue before the bare SKU: a machine is not in the
      // parts master, and a line reading "JME-VCS12-75" tells the desk nothing.
      const base = master?.name ?? storefrontMachine(it.sku)?.name ?? it.sku;
      // The configuration IS what is being quoted. A line saying only
      // "JME-VCS12-75" prices the standard 230V, 75-inch build for someone who
      // asked for 460V and 90 inches — and the customer signs that document.
      const cfg = it.config?.length ? it.config.join(" · ") : "";
      const qty = Math.max(1, +it.qty || 1);

      if (it === lead) {
        // The machine heads the document and its build is the spec table, so a
        // line repeating either reads as a second machine. It stays only when it
        // carries something the header cannot — a quantity above one.
        if (qty === 1) return null;
        return { sku: it.sku, name: base, qty, price: 0, rfq: true };
      }

      return {
        sku: it.sku,
        name: cfg ? `${base} — ${cfg}` : base,
        qty,
        price,
        // Unknown SKU or consult-priced part: carry it as an RFQ line so it is
        // visibly pending a price rather than quietly quoted at $0.
        rfq: price === 0,
      };
    })
    .filter((p): p is QcQuotePart => p !== null);

  q.notes = [
    // Loudest first: the rep is about to price a document whose heading stays
    // wrong until they pick the machine themselves.
    lead && !machine
      ? `SET THE MACHINE — ${lead.sku} was requested but has no single Quote Center entry. ${UNMAPPED[lead.sku] ?? ""}`.trim()
      : "",
    machineLines.length > 1
      ? `More than one machine requested (${machineLines.map((it) => it.sku).join(", ")}) — a quotation covers one machine, so the rest need their own.`
      : "",
    `Created from ${rfq.ref} (submitted ${rfq.createdAt.slice(0, 10)}).`,
    // Kept here as well as on the document: choosing a machine in the builder
    // replaces the customer's account of the build with the catalogue's, and
    // what they actually asked for must survive that.
    lead?.config?.length ? `Requested build: ${lead.config.join(" · ")}` : "",
    c.phone ? `Phone: ${c.phone}${c.phoneExt ? ` ext. ${c.phoneExt}` : ""}` : "",
    c.serial ? `Machine serial: ${c.serial}` : "",
    c.billingSameAsShipping === false && c.billingAddress ? `Bill to: ${c.billingAddress}` : "",
    rfq.freight ? "FREIGHT QUOTE REQUESTED." : "",
    rfq.message ? `Customer note: "${rfq.message}"` : "",
    // Where a part was picked off a manual drawing. Kept as desk context rather
    // than on the line, since it is how fit gets confirmed rather than part of
    // what is being sold.
    ...rfq.items.filter((it) => it.source).map((it) => `${it.sku} picked from ${it.source}`),
  ]
    .filter(Boolean)
    .join("\n");

  return q;
}
