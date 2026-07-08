import type { DiagramPage, GoodstrongModel, ManualSection } from "./types";
import { catalog } from "./catalog";

/**
 * Goodstrong sheeter manual / exploded-view data.
 *
 * PART NUMBERS ARE REAL — sourced from JME_Parts_Master_2026.xlsx ("Parts
 * Master" sheet, public-safe fields only) for the Goodstrong ("GMC") family,
 * plus universal Accessories parts. See data/catalog.ts for the full import.
 *
 * DIAGRAM LAYOUT IS STILL PLACEHOLDER — page images, bubble/callout
 * positions, and per-assembly quantities below are NOT from a real manual.
 * Access to the "Goodstrong manuals" Drive folder was granted, but every
 * read this session was rejected by the connector ("MCP tool call requires
 * approval"). Once that's unblocked: replace each area's `image`,
 * `pageNumber`, `hotspots`, and `qty` with the real manual page and its real
 * bubble layout — the part numbers themselves already come from real data
 * and shouldn't need to change.
 */
export const REAL_PART_NUMBERS = true;
export const REAL_DIAGRAM_LAYOUT = false;

const AREAS: { id: string; label: string }[] = [
  { id: "blades", label: "Blades" },
  { id: "brakes", label: "Brakes" },
  { id: "hardware", label: "Hardware" },
  { id: "belts", label: "Belts" },
  { id: "electronics", label: "Electronics" },
  { id: "motors", label: "Motors" },
  { id: "wheels", label: "Wheels" },
  { id: "hydraulics", label: "Hydraulics" },
  { id: "software", label: "Computer & Software" },
  { id: "accessories", label: "Accessories" },
  { id: "rollers", label: "Rollers" },
  { id: "bearings", label: "Bearings & Bushings" },
  { id: "guards", label: "Covers, Safety & Guards" },
  { id: "conveyors", label: "Conveyors, Loft Tables & Web Guides" },
];

/** Real catalog categories that currently have Goodstrong (or universal) parts, per area. */
const AREA_CATEGORIES: Record<string, string[]> = {
  blades: ["Blades"],
  brakes: ["Brake Systems"],
  belts: ["Belts"],
  motors: ["Motors"],
  electronics: ["Electrical / Controls", "Sensors"],
  accessories: ["Tape", "Tools"],
};

function sampleSections(): ManualSection[] {
  let page = 1;
  return AREAS.map((a) => {
    const startPage = page;
    const endPage = page + 3;
    page = endPage + 1;
    return { id: a.id, label: a.label, startPage, endPage };
  });
}

/** Build a placeholder-layout page populated with real part numbers for one area, if any exist. */
function buildAreaPage(areaId: string, section: ManualSection, families: string[]): DiagramPage | null {
  const parts = catalog.parts.filter(
    (p) => (p.sku.startsWith("JME-GMC-") || p.sku.startsWith("JME-ACC-")) && p.category && families.includes(p.category),
  );
  if (parts.length === 0) return null;
  return {
    pageNumber: section.startPage,
    image: "placeholder.svg",
    caption: `${section.label} — real part numbers; diagram page image and bubble layout are placeholders pending the real Goodstrong manual`,
    hotspots: parts.map((p, i) => ({ bubble: i + 1, x: 22 + (i % 3) * 28, y: 28 + Math.floor(i / 3) * 28 })),
    parts: parts.map((p, i) => ({ bubble: i + 1, sku: p.sku, name: p.name, qty: 1 })),
  };
}

function buildModel(id: string, label: string, machineSku?: string): GoodstrongModel {
  const sections = sampleSections();
  const diagrams: Record<string, DiagramPage[]> = {};
  for (const section of sections) {
    const families = AREA_CATEGORIES[section.id];
    if (!families) continue;
    const page = buildAreaPage(section.id, section, families);
    if (page) diagrams[section.id] = [page];
  }
  return {
    id,
    label,
    machineSku,
    photo: null,
    serialPattern: "PENDING — confirm the real serial format from the manual's ID-plate page",
    sections,
    diagrams,
  };
}

export const goodstrongModels: GoodstrongModel[] = [
  buildModel("1600", "Goodstrong 1600"),
  buildModel("1600e", "Goodstrong 1600-E"),
  buildModel("1650", "Goodstrong 1650", "GMC-TCII-1650"),
];

export function findGoodstrongModel(id: string): GoodstrongModel | undefined {
  return goodstrongModels.find((m) => m.id === id);
}

/**
 * Serial matcher: a plain substring heuristic against the model id. Replace
 * with the manual's real serial-range table once Drive access works.
 */
export function matchSerialToModel(serial: string): GoodstrongModel | undefined {
  const s = serial.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!s) return undefined;
  if (s.includes("1600E")) return findGoodstrongModel("1600e");
  if (s.includes("1650")) return findGoodstrongModel("1650");
  if (s.includes("1600")) return findGoodstrongModel("1600");
  return undefined;
}
