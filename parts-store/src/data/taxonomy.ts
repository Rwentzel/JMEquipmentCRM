import type { Part } from "./types";
import { PARTS_PUBLIC, PART_FAMILIES } from "./partsCatalog";

/**
 * Parts taxonomy — deterministic family → subsystem classification.
 *
 * The generated public catalog carries only the machine family; the browse
 * experience needs a second level (McMaster-style) so related parts sit
 * together — splitter knives next to knife holders, brake pads next to
 * rotors. Classification is keyword rules over the public description,
 * FIRST MATCH WINS, so rule order encodes priority (a "knife holder"
 * matches Knives & Cutting before any holder/hardware bucket).
 *
 * Pure and data-driven — no network, no private fields, unit-testable.
 */

interface SubRule {
  sub: string;
  re: RegExp;
}

const FALLBACK: Record<string, string> = {
  Sheeter: "Frames & Hardware",
  Rollstand: "Rollstand Components",
  Brakes: "Brake Components",
  Hydraulic: "Hydraulic Components",
  "Core Splitter": "Machine Parts",
  "Edge Guide & Tension": "Tension Components",
  Decurler: "Decurler Components",
  Other: "General Components",
};

const RULES: Record<string, SubRule[]> = {
  Sheeter: [
    { sub: "Knives & Cutting", re: /knife|knives|blade|slitter|anvil|shear|cut[- ]?off|score/i },
    { sub: "Unwind & Splicing", re: /unwind|splic/i },
    { sub: "Stacker & Jogger", re: /jogger|stacker|stack|backstop|table|lay ?boy|layboy/i },
    { sub: "Conveyor & Overlap", re: /conveyor|overlap|vacuum|suction|tape/i },
    { sub: "Rollers & Web Handling", re: /roller|nip|idler|web|pull ?roll|feed ?roll|reject|decurl|roll\b/i },
    { sub: "Bearings & Bushings", re: /bearing|bushing|pillow ?block/i },
    { sub: "Drive & Transmission", re: /belt|gear|pulley|sprocket|chain|coupling|timing|reducer|clutch|drive|sheave/i },
    { sub: "Pneumatics & Hydraulics", re: /cylinder|valve|pump|regulator|air|pneumatic|hydraulic|hose|fitting/i },
    { sub: "Electrical & Controls", re: /motor|sensor|switch|encoder|relay|cable|solenoid|photo ?(eye|cell)|controller|control|display|button|light|fuse|proximity|servo/i },
  ],
  Rollstand: [
    { sub: "Chucks & Shafts", re: /chuck|shaft|core|arbor|spindle/i },
    { sub: "Lift & Leadscrews", re: /lift|screw|wheel|jack|elevat/i },
    { sub: "Bearings & Bushings", re: /bearing|bushing|brass/i },
    { sub: "Hydraulics & Cylinders", re: /cylinder|valve|pump|hydraulic/i },
    { sub: "Drive & Transmission", re: /belt|gear|coupling|chain|drive|ring/i },
  ],
  Brakes: [
    { sub: "Pads & Discs", re: /pad|disc|rotor|kevlar|friction/i },
    { sub: "Calipers & Pistons", re: /caliper|piston|diaphragm|master|cylinder|push ?rod/i },
    { sub: "Air & Cooling", re: /air|gauge|fitting|fan|filter|psi/i },
    { sub: "Guards & Mounting", re: /guard|mount|plate|bracket|cover|cage|housing|spacer|bushing/i },
  ],
  Hydraulic: [
    { sub: "Valves & Spools", re: /valve|spool|solenoid|pilot|check|relief|directional/i },
    { sub: "Cylinders & Motors", re: /cylinder|motor|actuator/i },
    { sub: "Pumps & Power Units", re: /pump|power ?unit|reservoir|tank/i },
    { sub: "Seals, Filters & Kits", re: /seal|filter|kit|o-?ring|gasket|packing/i },
  ],
  "Core Splitter": [
    { sub: "Blades & Knives", re: /knife|knives|blade|holder|anvil/i },
    { sub: "Hydraulics & Pneumatics", re: /valve|pump|hydraulic|seal|cylinder|pressure|directional|flow/i },
    { sub: "Electrical & Controls", re: /switch|motor|control|sensor|relay|timer|button|light/i },
    { sub: "Drive & Mechanical", re: /belt|chuck|chain|timing|gear|door|plate|block|spring/i },
  ],
  "Edge Guide & Tension": [
    { sub: "Sensors & Detectors", re: /detector|sensor|ultrasonic|eye|scan/i },
    { sub: "Actuators & Drives", re: /actuator|servo|motor|stroke|thrust|pulley|belt/i },
    { sub: "Controls & Cables", re: /controller|control|cable|amplifier|board/i },
  ],
  Decurler: [],
  Other: [],
};

const cache = new Map<string, string>();

/** Subsystem for a part — first matching rule in its family, else fallback. */
export function subsystemOf(p: Part): string {
  const hit = cache.get(p.sku);
  if (hit) return hit;
  const rules = RULES[p.cat] ?? [];
  const found = rules.find((r) => r.re.test(p.name))?.sub ?? FALLBACK[p.cat] ?? "General Components";
  cache.set(p.sku, found);
  return found;
}

export interface TaxonomySub {
  name: string;
  count: number;
}

export interface TaxonomyFamily {
  family: string;
  count: number;
  subs: TaxonomySub[];
}

/** family → subsystems with counts, in catalog order — drives the browse rail. */
export const TAXONOMY: TaxonomyFamily[] = PART_FAMILIES.map((family) => {
  const parts = PARTS_PUBLIC.filter((p) => p.cat === family);
  const bySub = new Map<string, number>();
  for (const p of parts) bySub.set(subsystemOf(p), (bySub.get(subsystemOf(p)) ?? 0) + 1);
  const order = [...(RULES[family] ?? []).map((r) => r.sub), FALLBACK[family] ?? "General Components"];
  const subs = order
    .filter((s, i) => order.indexOf(s) === i && bySub.has(s))
    .map((name) => ({ name, count: bySub.get(name)! }));
  return { family, count: parts.length, subs };
}).sort((a, b) => b.count - a.count);
