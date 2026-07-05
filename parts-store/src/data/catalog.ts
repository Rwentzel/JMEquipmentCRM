import type { Catalog } from "./types";
import { PARTS_PUBLIC, PART_FAMILIES } from "./partsCatalog";

/**
 * JME Parts Store — public catalog (RFQ-first).
 *
 * PUBLIC-SAFE FIELDS ONLY (see data/types.ts and DATA_BOUNDARIES.md):
 * no price, no cost, no exact quantity, no vendor/OEM/bin/QuickBooks data.
 * Availability is expressed only as one of the 7 allowed status bands.
 *
 * Machine copy is outcome-led (2026 B2B merchandising): every machine states
 * who it's for and what it does for them, with claims drawn from JME's own
 * published materials — never invented performance numbers.
 */
export const catalog: Catalog = {
  contact: {
    company: "JM Equipment Inc.",
    tagline: "Converting Machinery Solutions",
    address: "405 1/2 West Congress St · Sturgis, MI 49091",
    city: "Sturgis, Michigan",
    est: 1989,
    phone: "(269) 659-0093",
    email: "parts@jmequipment.net",
  },
  machines: [
    {
      sku: "JME-VCS12-75",
      name: "JME Hydraulic Core Splitter",
      family: "Core Splitter",
      tag: "consult",
      tagLabel: "JME Build · Flagship",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: "core-splitter.png",
      fit: "contain",
      blurb:
        'Vertical single-stroke hydraulic core splitter — turns spent OCC/kraft cores into clean, stackable recyclable material in under 30 seconds, with virtually no noise or dust. 12" head · 75" frame.',
      bestFor: "Mills and converters drowning in spent cores — and paying freight to haul air.",
      outcomes: [
        "3× more cores per pallet — ship material, not air",
        "Under 30 seconds per core, one operator",
        "Full safety cage with lock-out; quiet, dust-free splitting",
        "Vertical footprint fits virtually anywhere on the floor",
      ],
      specs: [
        { k: "Power", v: "5 HP / 230V 1Ø" },
        { k: "Controller", v: "AB Micro 810" },
        { k: "Footprint", v: "30 × 30 in" },
        { k: "Wall Capacity", v: "¼–⅝ in" },
      ],
    },
    {
      sku: "GMC-TCII-1650",
      name: "1650 Dual Rotary Sheeter",
      family: "Sheeter",
      tag: "blue",
      tagLabel: "Goodstrong · Factory-Direct",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: "sheeter-1650.jpg",
      fit: "cover",
      blurb:
        "Goodstrong's high-end dual rotary sheeter, factory-direct through JME — new cutter-head design for a faster speed curve, with upgraded overlap and stacker sections standard.",
      bestFor: "High-volume paperboard converters who need cut-size accuracy at production speed.",
      outcomes: [
        "Cutting curve to 350 m/min (1,150 ft/min)",
        "Web widths 400–1,650 mm (16–65 in)",
        "Coated & uncoated board to 1,000 gsm (C1S / C2S)",
        "Web conditioning + shaftless pivot-arm rollstand in line",
      ],
      specs: [
        { k: "Web Width", v: "400–1650 mm" },
        { k: "Cut-off Length", v: "400–1778 mm" },
        { k: "Cutting Curve", v: "to 350 m/min" },
        { k: "Knife Loading", v: "to 1000 gsm" },
      ],
    },
    {
      sku: "GMC-1600E",
      name: "1600-E Dual Rotary Sheeter",
      family: "Sheeter",
      tag: "blue",
      tagLabel: "Goodstrong · Value Line",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: "sheeter-1600e.jpg",
      fit: "cover",
      blurb:
        "The proven Goodstrong dual-rotary platform in a right-sized package — dependable sheeting for shops that don't need every option on the 1650.",
      bestFor: "Growing converters stepping up from a single-knife or aging used sheeter.",
      outcomes: [
        "Dual rotary knife section — clean cut-offs at speed",
        "Same factory-direct support from Sturgis",
        "Simple operator controls, fast changeovers",
      ],
      specs: [
        { k: "Web Width", v: "to 1600 mm" },
        { k: "Knives", v: "Dual rotary" },
        { k: "Platform", v: "Goodstrong GMC" },
        { k: "Support", v: "JME · Sturgis, MI" },
      ],
    },
    {
      sku: "JME-RR-16",
      name: "JME RollRite Rollstand",
      family: "Rollstand",
      tag: "default",
      tagLabel: "JME Build · New",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: null,
      blurb:
        "JME's own shaftless rollstand — dependable unwinding ahead of slitters, sheeters, bag machines, forming presses, and laminators.",
      bestFor: "Lines that need dependable shaftless unwinding without wrestling core shafts.",
      outcomes: [
        "Shaftless loading — no core shafts to handle",
        "Core sizes 4 / 3–6 / 10–12 / 16 in, custom chucks available",
        "Built new in Sturgis with parts on the shelf",
      ],
      specs: [
        { k: "Core Sizes", v: "4 / 3–6 / 10–12 / 16 in" },
        { k: "Chucks", v: "Custom available" },
        { k: "Style", v: "Shaftless" },
        { k: "Duty", v: "Slitters · sheeters · laminators" },
      ],
    },
    {
      sku: "GMM-RS-RB",
      name: "Geo M. Martin Rollstand",
      family: "Rollstand",
      tag: "green",
      tagLabel: "Rebuilt OEM+",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: null,
      blurb:
        "Geo M. Martin rollstands rebuilt to tighter-than-original spec — like-new performance that extends the life of your original investment, with repair parts stocked in Sturgis.",
      bestFor: "Plants running Martin rollstands that want like-new performance without new-machine lead time.",
      outcomes: [
        "Rebuilt to tighter-than-original spec (OEM+)",
        "Extends the life of the original investment",
        "Brakes, filters, and alignment parts on the shelf",
      ],
      specs: [
        { k: "Core Range", v: "4–16 in" },
        { k: "Chucks", v: "Ribbed / mech. exp." },
        { k: "Brake", v: "Pneumatic" },
        { k: "Parts", v: "Brakes · filters · alignment" },
      ],
    },
    {
      sku: "JME-GC-52",
      name: "Guillotine Cutter",
      family: "Cutter",
      tag: "default",
      tagLabel: "Datien · New",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: null,
      blurb:
        "Datien precision guillotines for sheet trimming and ream cutting — double-blade pulling handle driven by two worm-gear sets, with shear-bolt protection against hard objects and blunt knives.",
      bestFor: "Finishing departments that trim reams and skids all day.",
      outcomes: [
        "Two worm-gear sets — fast, accurate cuts",
        "Shear-bolt design protects the machine, not the other way around",
        "Hydraulic clamp with two-hand + light-curtain safety",
      ],
      specs: [
        { k: "Cut Width", v: "to 52 in" },
        { k: "Backgauge", v: "Programmable" },
        { k: "Clamp", v: "Hydraulic" },
        { k: "Safety", v: "Two-hand + light curtain" },
      ],
    },
    {
      sku: "JME-AS-08",
      name: "Automatic Splicer",
      family: "Splicer",
      tag: "default",
      tagLabel: "New / Rebuilt",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: null,
      blurb: "Zero-speed flying splice keeps the web running through roll changes.",
      bestFor: "Web lines that can't afford to stop for roll changes.",
      outcomes: [
        "Zero-speed flying splice — the web keeps running",
        "Roll diameters to 60 in",
        "PLC/HMI control integrates with existing drives",
      ],
      specs: [
        { k: "Web Width", v: "to 1650 mm" },
        { k: "Splice", v: "Zero-speed" },
        { k: "Roll Dia", v: "to 60 in" },
        { k: "Control", v: "PLC / HMI" },
      ],
    },
    {
      sku: "JME-DC-04",
      name: "JME Decurler",
      family: "Decurler",
      tag: "default",
      tagLabel: "JME Build",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: null,
      blurb: "Removes residual roll curl ahead of the sheeter for flatter sheets and squarer stacks.",
      bestFor: "Sheeters fighting roll-set curl and bowed stacks.",
      outcomes: [
        "Flatter sheets into the stacker — fewer jams downstream",
        "Adjustable bars tune curl removal per grade",
        "Inline mount, idler-driven — no extra drive needed",
      ],
      specs: [
        { k: "Web Width", v: "to 1650 mm" },
        { k: "Bars", v: "Adjustable" },
        { k: "Mount", v: "Inline" },
        { k: "Drive", v: "Idler" },
      ],
    },
  ],
  parts: PARTS_PUBLIC,
  cats: ["All", ...PART_FAMILIES],
};
