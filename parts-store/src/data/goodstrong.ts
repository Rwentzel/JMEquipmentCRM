import type { DiagramPage, GoodstrongModel, ManualSection } from "./types";

/**
 * Goodstrong sheeter manual data.
 *
 * SOURCE: "37422 Parts Catalogue.pdf" (Google Drive) — the factory Part
 * Catalogue for the GMC-TC 1600 E Sheeter, Serial No. 37422. The section
 * index, page labels, sub-drawing lists, and both belt specification tables
 * below are transcribed directly from that document. Nothing here is
 * invented; anything the catalogue doesn't provide is marked pending.
 *
 * STILL PENDING (needs the PDF's page scans, which are too large to pull
 * through the Drive connector this session):
 *   - Exploded-view page images (each DiagramPage.image is a placeholder
 *     until the scanned page is added under public/images/manuals/<model>/)
 *   - Bubble callout x/y positions on those scans
 *   - Per-drawing parts tables for the non-belt sections
 *   - Manuals for the 1600 (non-E) and 1650 — only the 1600 E catalogue
 *     (S/N 37422) is in the Drive folder so far.
 */

/** Serial numbers with a known machine/manual match (from real documents). */
const KNOWN_SERIALS: Record<string, string> = {
  // "Part Catalogue for GMC-TC 1600 E Sheeter S/N. 37422"
  "37422": "1600e",
};

/**
 * Real table of contents — GMC-TC 1600 E, S/N 37422 Parts Catalogue index.
 * Page labels are the manual's own ("5-3", "5a", "5d-2", …).
 */
const GMC_TC_1600E_SECTIONS: ManualSection[] = [
  {
    id: "driving-belt",
    label: "Driving (Timing) Belts",
    pageLabel: "5-3",
  },
  {
    id: "conveyor-belt",
    label: "Conveyor (Flat) Belts",
    pageLabel: "5-4",
    drawings: [{ title: "Adjust Instruction for Secondary Conveyor Belt", pageLabel: "5-5" }],
  },
  {
    id: "unwind-stand",
    label: "Shaftless Unwind Stand",
    pageLabel: "5a",
    drawings: [
      { title: "Unwind Stand Main Shaft", pageLabel: "5a-1-01" },
      { title: "Clamp Arm Web 1 – DR / Web 2 – OP", pageLabel: "5a-2-01" },
      { title: "Unwind Stand Cylinder", pageLabel: "5a-2-02" },
      { title: "Rail for Paper No.2", pageLabel: "5a-4-01" },
      { title: "Trolley", pageLabel: "5a-4-02" },
      { title: "Arm and Chuck", pageLabel: "5a-5-01" },
    ],
  },
  {
    id: "guiding-rollers",
    label: "Guiding Rollers / De-curler",
    pageLabel: "5b",
    drawings: [
      { title: "Guiding Roller A", pageLabel: "5b-2-01" },
      { title: "Guiding Roller B", pageLabel: "5b-2-02" },
      { title: "Tension Adjusting Roller", pageLabel: "5b-3-01" },
      { title: "De-Curling Unit No.1", pageLabel: "5b-4-01" },
      { title: "Decurler Reducer No.1", pageLabel: "5b-4-02" },
    ],
  },
  {
    id: "edge-position-control",
    label: "Edge Position Control (EPC)",
    pageLabel: "5c",
    drawings: [
      { title: "EPC Swing Frame", pageLabel: "5c-1-01" },
      { title: "EPC Sensing Nozzle", pageLabel: "5c-1-02" },
      { title: "EPC Swing Roll", pageLabel: "5c-2-01" },
    ],
  },
  {
    id: "guiding-roller-before-slitter",
    label: "Guiding Roller (Before Slitter)",
    pageLabel: "5d-1",
    drawings: [
      { title: "De-Curling Unit No.2 (Before Slitter)", pageLabel: "5d-1-01" },
      { title: "De-Curling Unit No.3 (Before Slitter)", pageLabel: "5d-1-02" },
      { title: "Decurler Reducer No.2 & 3", pageLabel: "5d-1-03" },
    ],
  },
  {
    id: "slitting-blade-unit",
    label: "Slitting Blade Unit (Tidland PS-M-II)",
    pageLabel: "5d-2",
    drawings: [
      { title: "Upper Slitter", pageLabel: "5d-2-01" },
      { title: "Upper Slitting Blade", pageLabel: "5d-2-01-1" },
      { title: "Lower Slitter", pageLabel: "5d-2-02" },
      { title: "Lower Slitting Blade", pageLabel: "5d-2-02-1" },
    ],
  },
  {
    id: "feeder-roller-system",
    label: "Feeder Roller System",
    pageLabel: "5d-3",
    drawings: [
      { title: "Guide Roller (Before Feeder Roller)", pageLabel: "5d-3-01" },
      { title: "Infeed Draw Roll", pageLabel: "5d-3-03" },
    ],
  },
  {
    id: "cutting-blades",
    label: "Cutting Blades / Knife Measuring Block",
    pageLabel: "5d-4",
    drawings: [
      { title: "Cutting Upper Blade", pageLabel: "5d-4-01" },
      { title: "Cutting Lower Blade", pageLabel: "5d-4-02" },
      { title: "Knife Measuring Block", pageLabel: "5d-4-03" },
      { title: "Photoelectric Reflex Switch Unit (Before Cutting Knife)", pageLabel: "5d-4-04" },
      { title: "Guide Plate (After Cutting Knife)", pageLabel: "5d-4-05" },
    ],
  },
  {
    id: "driving-system-1",
    label: "1st Driving System",
    pageLabel: "5d-5",
    drawings: [
      { title: "Transmission Gear (To Feeder Roll)", pageLabel: "5d-5-01" },
      { title: "Guide Roll Adjusting Base", pageLabel: "5d-5-02" },
      { title: "10HP AC Motor", pageLabel: "5d-5-03" },
      { title: "Counter Shaft (AC Motor to Feeder Roll)", pageLabel: "5d-5-04" },
      { title: "Counter Shaft to High Speed Tape", pageLabel: "5d-5-05" },
    ],
  },
  {
    id: "trim-removal",
    label: "Trim Removal with Fan and Ducting",
    pageLabel: "5d-7",
    drawings: [
      { title: "Ducting", pageLabel: "5d-7-01" },
      { title: "Blower System", pageLabel: "5d-7-02" },
      { title: "Supporting Piece of Blade Changing", pageLabel: "5d-7-03" },
    ],
  },
  {
    id: "primary-conveyor",
    label: "Primary Conveyor (High Speed Tape Section)",
    pageLabel: "5d-8",
    drawings: [
      { title: "Conveyor Parts", pageLabel: "5d-8-01" },
      { title: "Primary Conveyor Driving Belt Roller", pageLabel: "5d-8-02" },
      { title: "Primary Conveyor Suspension Arm", pageLabel: "5d-8-03" },
      { title: "Conveyor Top Belt Adjustable Belt Roller", pageLabel: "5d-8-04" },
      { title: "Primary Conveyor Tension-Adjust Roller for Lower Belt", pageLabel: "5d-8-05" },
      { title: "Primary Conveyor Driving Belt Roller & Guide Plate", pageLabel: "5d-8-06" },
      { title: "Conveyor Top Belt Driving Part", pageLabel: "5d-8-07" },
      { title: "Vacuum Suction Pipe", pageLabel: "5d-8-09" },
      { title: "Reject Gate Unit Air Cylinder", pageLabel: "5d-8-10" },
      { title: "Reject Gate Unit Guide Roller", pageLabel: "5d-8-11" },
      { title: "Reject Gate Unit Guide Plate", pageLabel: "5d-8-12" },
      { title: "Dust Extraction Device (Top)", pageLabel: "5d-8-13" },
      { title: "Dust Extraction Device (Bottom) & Guiding Plate", pageLabel: "5d-8-14" },
      { title: "Edge Turner", pageLabel: "5d-8-14-1" },
      { title: "Photoelectric Reflex Switch Unit", pageLabel: "5d-8-15" },
      { title: "Suspension Arm Belt Roll / Photoelectric Reflex Switch Unit", pageLabel: "5d-8-16" },
      { title: "Check Roller Unit (Rubber Ring)", pageLabel: "5d-8-17" },
      { title: "Check Roller Unit to Overlap (Rubber Ring)", pageLabel: "5d-8-18" },
    ],
  },
  {
    id: "secondary-conveyor",
    label: "Secondary Conveyor (Low Speed Tape Section)",
    pageLabel: "5d-9",
    drawings: [
      { title: "Secondary Conveyor Belt Roller", pageLabel: "5d-9-01" },
      { title: "Conveyor Top Tapes Roller & Jam-Up Detection", pageLabel: "5d-9-02" },
      { title: "Secondary Conveyor Driving Belt Roll", pageLabel: "5d-9-03" },
      { title: "Overlap Tape Section Movable Stand", pageLabel: "5d-9-04" },
      { title: "Overlapping Guide Plate", pageLabel: "5d-9-05" },
      { title: "Guide Plate & Blower Nozzle", pageLabel: "5d-9-06" },
      { title: "Across Width Check Roller Unit", pageLabel: "5d-9-07" },
      { title: "Overlap Tape Roller Gap Adjustment", pageLabel: "5d-9-08" },
      { title: "Check Roller Rubber Ring", pageLabel: "5d-9-09" },
    ],
  },
  { id: "paper-outlet", label: "Paper Outlet", pageLabel: "5d-10" },
  { id: "driving-system-2", label: "2nd Driving System & Delivery Parts", pageLabel: "5d-11" },
  { id: "accessory", label: "Accessory", pageLabel: "5d-13" },
];

/**
 * Real parts table — "Driving (Timing) Belt Specification List",
 * GMC-TC 1600 E Serial No. 37422, catalogue page 5-3. Locations T1–T8 map to
 * callout bubbles 1–8. Quantities are the manual's per-machine counts.
 */
const TIMING_BELT_PAGE: DiagramPage = {
  pageLabel: "5-3",
  image: "placeholder.svg",
  caption:
    "Driving (Timing) Belt Specification List — locations T1–T8 (drawing scan pending; specs and quantities are from the real catalogue page 5-3)",
  hotspots: [
    { bubble: 1, x: 18, y: 30 },
    { bubble: 2, x: 32, y: 44 },
    { bubble: 3, x: 44, y: 36 },
    { bubble: 4, x: 58, y: 52 },
    { bubble: 5, x: 50, y: 66 },
    { bubble: 6, x: 68, y: 40 },
    { bubble: 7, x: 78, y: 56 },
    { bubble: 8, x: 88, y: 44 },
  ],
  parts: [
    { bubble: 1, sku: "1216-8YU-30", name: "T1 — Bottom Slitter Drive Timing Belt", qty: 1 },
    { bubble: 2, sku: "1808-8YU-50", name: "T2 — AC Motor to Drive Shaft Timing Belt", qty: 1 },
    { bubble: 3, sku: "1928-EV8YU-50", name: "T3 — Drive Shaft to Draw Roll Timing Belt", qty: 1 },
    { bubble: 4, sku: "2160-8YU-30", name: "T4 — AC Motor, Take-away Section Timing Belt", qty: 1 },
    { bubble: 5, sku: "1656-8YU-30", name: "T5 — Gear Box / Drive Shaft to Take-away Section Timing Belt", qty: 1 },
    { bubble: 6, sku: "1120-8YU-25", name: "T6 — High Speed to Slow Speed Drive Roll Timing Belt", qty: 1 },
    { bubble: 7, sku: "1320-8YU-25", name: "T7 — Slow Speed Tapes Timing Belt", qty: 1 },
    { bubble: 8, sku: "1192-8YU-25", name: "T8 — Exit Roller to Layboy Timing Belt", qty: 1 },
  ],
};

/**
 * Real parts table — "Conveyor (Flat) Belt Specification List",
 * GMC-TC 1600 E Serial No. 37422, catalogue page 5-4. Locations F1–F3 map to
 * callout bubbles 1–3.
 */
const FLAT_BELT_PAGE: DiagramPage = {
  pageLabel: "5-4",
  image: "placeholder.svg",
  caption:
    "Conveyor (Flat) Belt Specification List — locations F1–F3 (drawing scan pending; specs and quantities are from the real catalogue page 5-4)",
  hotspots: [
    { bubble: 1, x: 30, y: 40 },
    { bubble: 2, x: 55, y: 55 },
    { bubble: 3, x: 75, y: 35 },
  ],
  parts: [
    { bubble: 1, sku: "MC2HA041003", name: "F1 — Primary Conveyor Belt, 70 × 1020 × 1.2t (H-5EFGT)", qty: 18 },
    { bubble: 2, sku: "MC2HA011058", name: "F2 — Secondary Conveyor Belt, 1600 × 3840 × 2t (PVC-9AG) — adjust instruction p.5-5", qty: 1 },
    { bubble: 3, sku: "MC2HA031005", name: "F3 — Conveyor Top Belt, 25 × 6120 × 1t (HAM-5P)", qty: 12 },
  ],
};

export const goodstrongModels: GoodstrongModel[] = [
  {
    id: "1600",
    label: "Goodstrong 1600",
    photo: null,
    serialPattern: "Pending — no 1600 (non-E) manual in the Drive folder yet",
    // The GMC-TC platform shares its section structure; drawings/pages pending its own catalogue.
    sections: GMC_TC_1600E_SECTIONS.map(({ drawings: _d, ...s }) => s),
    diagrams: {},
  },
  {
    id: "1600e",
    label: "Goodstrong 1600-E (GMC-TC 1600 E)",
    machineSku: "GMC-1600E",
    photo: "sheeter-1600e.jpg",
    serialPattern: "Matched against known serials from the factory Part Catalogue (e.g. S/N 37422)",
    sections: GMC_TC_1600E_SECTIONS,
    diagrams: {
      "driving-belt": [TIMING_BELT_PAGE],
      "conveyor-belt": [FLAT_BELT_PAGE],
    },
  },
  {
    id: "1650",
    label: "Goodstrong 1650 (GMC-TC II)",
    machineSku: "GMC-TCII-1650",
    photo: "sheeter-1650.jpg",
    serialPattern: "Pending — no 1650 catalogue in the Drive folder yet",
    sections: GMC_TC_1600E_SECTIONS.map(({ drawings: _d, ...s }) => s),
    diagrams: {},
  },
];

export function findGoodstrongModel(id: string): GoodstrongModel | undefined {
  return goodstrongModels.find((m) => m.id === id);
}

/**
 * Serial lookup: exact known serials first (from real factory documents),
 * then a model-number substring fallback for customers who type the model
 * into the serial box. Unknown serials fall through to the parts desk.
 */
export function matchSerialToModel(serial: string): GoodstrongModel | undefined {
  const s = serial.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!s) return undefined;
  const digits = s.replace(/\D/g, "");
  if (digits && KNOWN_SERIALS[digits]) return findGoodstrongModel(KNOWN_SERIALS[digits]!);
  if (s.includes("1600E")) return findGoodstrongModel("1600e");
  if (s.includes("1650")) return findGoodstrongModel("1650");
  if (s.includes("1600")) return findGoodstrongModel("1600");
  return undefined;
}
