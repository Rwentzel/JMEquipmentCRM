import type { Catalog } from "./types";
import { PARTS_PUBLIC, PART_FAMILIES } from "./partsCatalog";

/**
 * JME Parts Store — public catalog (sandbox demo data, RFQ-first).
 *
 * PUBLIC-SAFE FIELDS ONLY (see data/types.ts and DATA_BOUNDARIES.md):
 * no price, no cost, no exact quantity, no vendor/OEM/bin/QuickBooks data.
 * Availability is expressed only as one of the 7 allowed status bands.
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
      tagLabel: "Consult",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: "core-splitter.png",
      fit: "contain",
      blurb:
        'Hydraulic single-stroke vertical core splitter — converts spent OCC/kraft cores to recyclable material in under 30 seconds. 12" head · 75" frame.',
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
        "New Goodstrong GMC-TCII dual rotary sheeter, factory-direct — no dealer stack.",
      specs: [
        { k: "Web Width", v: "1650 mm" },
        { k: "Sheet Length", v: "450–1800 mm" },
        { k: "Speed", v: "180 m/min" },
        { k: "Knives", v: "Dual rotary" },
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
        "JME's own shaftless rollstand — feeds slitters, sheeters, bag machines, forming presses, and laminators.",
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
        "Geo M. Martin rollstands rebuilt to tighter-than-original spec — plus repair parts stocked in Sturgis.",
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
      tagLabel: "New / Rebuilt",
      statusBand: "Quote Required",
      action: "request-quote",
      photo: null,
      blurb:
        "Precision sheet trimming and ream cutting for finished converting lines.",
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
      blurb:
        "Zero-speed flying splice keeps the web running through roll changes.",
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
      blurb:
        "Removes residual roll curl ahead of the sheeter for flatter stacks.",
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
