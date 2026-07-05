import type { Catalog } from "./types";

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
    email: "sales@jmequipment.net",
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
  /**
   * Sourced from JME_Parts_Master_2026.xlsx ("Parts Master" sheet), public-safe
   * fields only — no vendor, cost, sell price, margin, or on-hand/bin data was
   * imported (see DATA_BOUNDARIES.md and that workbook's "Reference" sheet,
   * which states "No prices on website. RFQ-only for launch."). Every item's
   * statusBand is "Quote Required" until real, confirmed availability data
   * exists — none of these are yet stock-confirmed regardless of the
   * workbook's internal "Website Status" (draft/live) tracking column.
   */
  parts: [
    { sku: "JME-VCS-BLD-001", name: "Splitter Blade", cat: "Core Splitter", category: "Blades", fitment: "VCS 45/55/65/75", keywords: ["splitter blade", "core blade"], description: "Replacement cutting blade for hydraulic core splitter", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-VCS-KBH-001", name: "Knife Block Holder", cat: "Core Splitter", category: "Blade Holders", fitment: "VCS 45/55/65/75", keywords: ["knife block holder", "spare holder"], description: "Preloaded replacement knife holder", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-VCS-HYD-001", name: "Hydraulic Hose", cat: "Core Splitter", category: "Hydraulic", fitment: "All VCS", keywords: ["hydraulic hose", "pressure hose"], description: "Hydraulic pressure hose assembly", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-VCS-HYD-002", name: "Hydraulic Seal Kit", cat: "Core Splitter", category: "Hydraulic", fitment: "All VCS", keywords: ["seal kit", "cylinder seal"], description: "Cylinder seal replacement kit", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-VCS-ADA-001", name: "Core Adapter", cat: "Core Splitter", category: "Adapters", fitment: "8-16 inch", keywords: ["core adapter", "diameter adapter"], description: "Core diameter adapter", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-BLD-001", name: "Top Slitter Blade", cat: "Sheeter", category: "Blades", fitment: "TC1600E / TC II", keywords: ["top slitter blade", "slitter blade", "goodstrong blade"], description: "Rotary top slitter blade", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-BLD-002", name: "Bottom Slitter Anvil", cat: "Sheeter", category: "Blades", fitment: "TC1600E / TC II", keywords: ["bottom slitter anvil", "anvil roll"], description: "Slitter anvil roll", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-BRK-001", name: "Brake Pads", cat: "Sheeter", category: "Brake Systems", fitment: "TC Series", keywords: ["brake pads", "disc brake"], description: "Replacement brake pad set", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-BEL-001", name: "Conveyor Top Belt", cat: "Sheeter", category: "Belts", fitment: "TC Series", keywords: ["conveyor belt", "top belt", "transport belt"], description: "Conveyor transport belt", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-BEL-002", name: "Primary Conveyor Belt", cat: "Sheeter", category: "Belts", fitment: "TC Series", keywords: ["primary conveyor belt", "main belt"], description: "Primary belt assembly", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-BEL-003", name: "Secondary Conveyor Belt", cat: "Sheeter", category: "Belts", fitment: "TC Series", keywords: ["secondary conveyor belt"], description: "Secondary transport belt", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-SEN-001", name: "Counter Sensor", cat: "Sheeter", category: "Sensors", fitment: "TC Series", keywords: ["counter sensor", "photo sensor", "prox switch"], description: "Counter/photo sensor", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-SEN-002", name: "Dancer Sensor", cat: "Sheeter", category: "Sensors", fitment: "TC Series", keywords: ["dancer sensor", "tension sensor"], description: "Web tension sensor", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-SEN-003", name: "Decurl Encoder", cat: "Sheeter", category: "Sensors", fitment: "TC Series", keywords: ["decurl encoder", "encoder"], description: "Encoder for decurler", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-MTR-001", name: "Decurl Motor", cat: "Sheeter", category: "Motors", fitment: "TC Series", keywords: ["decurl motor", "decurler motor"], description: "Decurler motor assembly", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-BEL-004", name: "Timing Belt Set", cat: "Sheeter", category: "Belts", fitment: "TC Series", keywords: ["timing belt set", "timing belt", "drive belt"], description: "Timing drive belt kit", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-GMC-ELC-001", name: "Power Inverter", cat: "Sheeter", category: "Electrical / Controls", fitment: "TC Series", keywords: ["inverter", "drive inverter", "power inverter"], description: "Drive inverter", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-MRT-BRG-001", name: "Arbor Bearing", cat: "Rollstand", category: "Bearings", fitment: "Martin Rollstand", keywords: ["arbor bearing", "rollstand bearing"], description: "Arbor bearing replacement", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-MRT-CHK-001", name: "Chuck Arbor Shaft", cat: "Rollstand", category: "Shafts", fitment: "Martin Rollstand", keywords: ["chuck arbor shaft", "arbor shaft"], description: "Arbor shaft assembly", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-MRT-BRK-001", name: "Disc Brake Pads", cat: "Rollstand", category: "Brake Systems", fitment: "Martin Rollstand", keywords: ["disc brake pads", "rollstand brake"], description: "Brake pad set", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-MRT-HYD-001", name: "Hydraulic Filter", cat: "Rollstand", category: "Hydraulic", fitment: "Martin Rollstand", keywords: ["hydraulic filter", "filter cartridge"], description: "Filter cartridge", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-MRT-BLK-001", name: "Brass Alignment Block", cat: "Rollstand", category: "Alignment", fitment: "Martin Rollstand", keywords: ["brass alignment block", "alignment guide"], description: "Alignment guide block", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-MRT-HYD-002", name: "Directional Valve", cat: "Rollstand", category: "Hydraulic", fitment: "Martin Rollstand", keywords: ["directional valve", "hydraulic valve"], description: "Hydraulic directional valve", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-ACC-TAP-001", name: "Splicing Tape", cat: "Accessories", category: "Tape", fitment: "Universal", keywords: ["splicing tape", "industrial tape"], description: "Industrial splicing tape", statusBand: "Quote Required", action: "request-quote" },
    { sku: "JME-ACC-TOL-001", name: "Grinding Stone", cat: "Accessories", category: "Tools", fitment: "Universal", keywords: ["grinding stone", "sharpening stone"], description: "Blade sharpening stone", statusBand: "Quote Required", action: "request-quote" },
  ],
  cats: ["All", "Core Splitter", "Sheeter", "Rollstand", "Accessories", "Hydraulic"],
};
