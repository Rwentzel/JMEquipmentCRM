import type { MachineDetail } from "./types";

/**
 * Per-machine deep content for /machine/[sku]. Sandbox demo data.
 * Base prices are budgetary/indicative only — confirmed in writing before any order.
 */
export const details: Record<string, MachineDetail> = {
  "JME-VCS12-75": {
    tagline:
      "Convert spent OCC/kraft cores to recyclable material in under 30 seconds — and stop paying to haul dumpsters of waste cores.",
    lead: "The JME-VCS12-75 is a hydraulic single-stroke vertical core splitter engineered for high-volume OCC/kraft core processing. 12″ head, 75″ frame, 5 HP / 230V single-phase, Allen-Bradley Micro 810 PLC control. Built, supported, and rebuilt in Sturgis, Michigan.",
    heroStats: [
      { value: "< 30 s", label: "Per core" },
      { value: "5 HP", label: "230V 1Ø PLC" },
      { html: "13<em>mo</em>", label: "Typical payback" },
    ],
    badge: { status: "lead", label: "10–12 Week Build" },
    gallery: [
      { src: "core-splitter.png", cap: "Full machine — 75″ frame", fit: "contain" },
      { src: "core-splitter-pump.png", cap: "Hydraulic power pack — 5 HP", fit: "contain" },
      { src: "core-splitter-panel.png", cap: "AB Micro 810 control panel", fit: "contain" },
      { src: "split-core.png", cap: "Split core — recyclable", fit: "contain" },
    ],
    basePrice: 16000,
    options: [
      {
        id: "power",
        label: "Power",
        type: "radio",
        choices: [
          { v: "5 HP / 230V 1Ø", sku: "P1", price: 0, note: "Standard" },
          { v: "5 HP / 230V 3Ø", sku: "P3", price: 450 },
          { v: "5 HP / 460V 3Ø", sku: "P4", price: 650 },
        ],
      },
      {
        id: "frame",
        label: "Frame height",
        type: "radio",
        choices: [
          { v: "75 in (12″ head)", sku: "F75", price: 0, note: "Standard" },
          { v: "90 in (16″ head)", sku: "F90", price: 1850, note: "Extended" },
        ],
      },
      {
        id: "guard",
        label: "Guarding",
        type: "radio",
        choices: [
          { v: "Mesh cage + interlock", sku: "G1", price: 0, note: "Standard" },
          { v: "Light curtain", sku: "G2", price: 1200 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Crating for freight", sku: "CR", price: 800, note: "Recommended" },
          { v: "Spare blade set (4)", sku: "SB", price: 612 },
          { v: "Discharge chute", sku: "DC", price: 480 },
          { v: "Casters + leveling feet", sku: "CF", price: 320 },
        ],
      },
    ],
    how: [
      { n: "01", t: "Load", d: "Drop a spent OCC/kraft core upright into the guarded 75″ frame — no fixturing, no prep." },
      { n: "02", t: "Cycle", d: "A two-hand start drives the single-stroke hydraulic head through the core wall." },
      { n: "03", t: "Split", d: "The core is slit and converted to recyclable material in under 30 seconds." },
      { n: "04", t: "Recover", d: "Spent cores become recyclable stock — no dumpster, no haul cost." },
    ],
    apps: ["Paper mills", "Tissue & towel", "Folding carton", "Film & flexible", "Label & narrow web", "Recycling / MRF"],
    proof: {
      stat: "$16.5K",
      label: "Est. annual savings",
      quote:
        "Based on 30 cores/day × 250 days/year vs. dumpster haul — a ~13-month payback and $65,751 net over 5 years. Estimates only, not a financial guarantee.",
    },
    partsCat: "Core Splitter",
    downloads: [
      { t: "Spec sheet (PDF)", m: "JME-VCS12-75 · power, footprint, capacity" },
      { t: "ROI worksheet (XLSX)", m: "Plug in your core counts" },
      { t: "Blade-replacement guide", m: "Maintenance · 15 min" },
    ],
  },

  "GMC-TCII-1650": {
    tagline: "New Goodstrong dual-rotary sheeting — factory-direct, with a Michigan phone number behind it.",
    lead: "The GMC-TCII 1650 is a high-speed dual rotary knife sheeter for paper and board converters. Direct-drive knives, servo cutoff, and a stacking section that keeps a single operator productive — sold factory-direct without the dealer stack.",
    heroStats: [
      { value: "1650 mm", label: "Trim width" },
      { value: "180 m/min", label: "Web speed" },
      { html: "±0.4<em>mm</em>", label: "Cutoff accuracy" },
    ],
    badge: { status: "lead", label: "10–14 Week Lead" },
    gallery: [
      { src: "sheeter-1650.jpg", cap: "GMC-TCII 1650 sheeting line", fit: "cover" },
      { src: "sheeter-1600e.jpg", cap: "GMC-TCII 1600-E variant", fit: "cover" },
    ],
    basePrice: 168000,
    options: [
      {
        id: "width",
        label: "Trim width",
        type: "radio",
        choices: [
          { v: "1650 mm (65 in)", sku: "W65", price: 0, note: "Standard" },
          { v: "1600 mm (63 in) E", sku: "W63", price: -3200, note: "Economy" },
          { v: "1900 mm (75 in)", sku: "W75", price: 12400 },
        ],
      },
      {
        id: "webs",
        label: "Web stations",
        type: "radio",
        choices: [
          { v: "2 web", sku: "B2", price: 0, note: "Standard" },
          { v: "4 web", sku: "B4", price: 28500 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Tidland-style slitters", sku: "SL", price: 6400 },
          { v: "Motorized decurler", sku: "DC", price: 8900 },
          { v: "Overlap / shingle table", sku: "OL", price: 5200 },
          { v: "Non-stop pallet change", sku: "NS", price: 14800 },
        ],
      },
    ],
    how: [
      { n: "01", t: "Unwind", d: "Roll stands feed the web under tension into the sheeter bridge." },
      { n: "02", t: "Decurl & slit", d: "Optional decurler flattens residual curl; slitters trim to width." },
      { n: "03", t: "Cut", d: "Dual rotary knives cut to length at servo-controlled accuracy." },
      { n: "04", t: "Stack", d: "Overlap and shingle sections pile clean, square stacks for offload." },
    ],
    apps: ["Cut-size paper", "Folding carton", "Digital print stock", "Specialty & coated", "Board & liner"],
    proof: {
      stat: "40+ yrs",
      label: "Service life on a maintained line",
      quote: "Goodstrong sheeting platforms run for decades with JME parts and rebuild support behind them.",
    },
    partsCat: "Sheeter",
    downloads: [
      { t: "Spec sheet (PDF)", m: "Widths, speeds, options" },
      { t: "Line layout drawing", m: "Footprint & clearances" },
    ],
  },

  "MRS-72": {
    tagline: "Rebuilt Martin mill rollstands — feed any line with OEM+ confidence.",
    lead: "A mill rollstand sits behind your slitter, sheeter, die cutter, or corrugator to feed parent rolls smoothly under tension. JME rebuilds Martin stands to tighter-than-original spec, media-blasts and repaints to your color, and pressure-tests before it ships.",
    heroStats: [
      { value: "4–16 in", label: "Core range" },
      { value: "OEM+", label: "Rebuild spec" },
      { html: "150<em>%</em>", label: "Test pressure" },
    ],
    badge: { status: "stock", label: "In Stock / Rebuilt to Order" },
    gallery: [],
    basePrice: 24500,
    options: [
      {
        id: "chuck",
        label: "Chucks",
        type: "radio",
        choices: [
          { v: "Ribbed expanding", sku: "CR", price: 0, note: "Standard" },
          { v: "Mechanical expanding", sku: "CM", price: 1450 },
          { v: "Air-shaft", sku: "CA", price: 2600 },
        ],
      },
      {
        id: "brake",
        label: "Brake",
        type: "radio",
        choices: [
          { v: "Pneumatic", sku: "BP", price: 0, note: "Standard" },
          { v: "Magnetic-particle", sku: "BM", price: 3200 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Powered web guide", sku: "WG", price: 4200 },
          { v: "Load/unload arms", sku: "LA", price: 3800 },
          { v: "Custom paint to brand color", sku: "PT", price: 650 },
        ],
      },
    ],
    how: [
      { n: "01", t: "Mount", d: "Parent roll loads onto expanding chucks sized to your core ID." },
      { n: "02", t: "Tension", d: "The brake holds steady web tension as the downstream machine pulls." },
      { n: "03", t: "Guide", d: "Optional powered guide keeps the web tracking dead-center." },
      { n: "04", t: "Feed", d: "Smooth, controlled delivery into the sheeter, slitter, or die cutter." },
    ],
    apps: ["Sheeters", "Slitters", "Die cutters", "Corrugators", "Laminators"],
    proof: {
      stat: "150%",
      label: "Pressure-tested to operating",
      quote:
        "Every rebuild is disassembled, re-componented with new motors/valves/pumps, and proof-tested before it leaves Sturgis.",
    },
    partsCat: "Rollstand",
    downloads: [{ t: "Rebuild scope (PDF)", m: "Four-step process & checklist" }],
  },

  "JME-GC-52": {
    tagline: "Precision guillotine cutting for finished trims and ream work.",
    lead: "A programmable guillotine cutter for square, accurate trims at the end of the line. Hydraulic clamp, programmable backgauge, and a two-hand + light-curtain safety package. New or rebuilt to your throughput.",
    heroStats: [
      { value: "to 52 in", label: "Cut width" },
      { value: "PLC", label: "Programmable gauge" },
      { value: "2-hand", label: "Safety + curtain" },
    ],
    badge: { status: "lead", label: "Consult / Quote" },
    gallery: [],
    basePrice: 38500,
    options: [
      {
        id: "width",
        label: "Cut width",
        type: "radio",
        choices: [
          { v: "42 in", sku: "C42", price: 0, note: "Standard" },
          { v: "52 in", sku: "C52", price: 7800 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Air table", sku: "AT", price: 2400 },
          { v: "Backgauge memory", sku: "BG", price: 1900 },
          { v: "Side tables", sku: "ST", price: 1500 },
        ],
      },
    ],
    how: [
      { n: "01", t: "Set", d: "Program the backgauge to the trim dimension; recall stored jobs." },
      { n: "02", t: "Position", d: "Load the lift onto the air table and slide to the gauge." },
      { n: "03", t: "Clamp", d: "Hydraulic clamp secures the lift to prevent draw." },
      { n: "04", t: "Cut", d: "Two-hand start drives a clean, square guillotine cut." },
    ],
    apps: ["Ream finishing", "Sheet trimming", "Digital print", "Specialty converting"],
    proof: {
      stat: "±0.01 in",
      label: "Repeatable cut accuracy",
      quote: "Programmable backgauge holds dimension job-to-job for clean, salable trims.",
    },
    partsCat: "Sheeter",
    downloads: [{ t: "Spec sheet (PDF)", m: "Widths, safety, options" }],
  },

  "JME-AS-08": {
    tagline: "Zero-speed flying splice — keep the web running through every roll change.",
    lead: "An automatic splicer joins a new parent roll to the expiring one without stopping the line. Zero-speed splice mechanics, roll prep station, and PLC/HMI control hold throughput through changeovers.",
    heroStats: [
      { value: "to 1650 mm", label: "Web width" },
      { value: "Zero-speed", label: "Splice type" },
      { value: "to 60 in", label: "Roll diameter" },
    ],
    badge: { status: "lead", label: "Consult / Quote" },
    gallery: [],
    basePrice: 142000,
    options: [
      {
        id: "width",
        label: "Web width",
        type: "radio",
        choices: [
          { v: "1650 mm", sku: "W65", price: 0, note: "Standard" },
          { v: "1900 mm", sku: "W75", price: 9400 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Turret unwind", sku: "TU", price: 18500 },
          { v: "Splice-detect sensor", sku: "SD", price: 2200 },
          { v: "Dancer tension control", sku: "DT", price: 6800 },
        ],
      },
    ],
    how: [
      { n: "01", t: "Prep", d: "Stage the new roll and apply splice tape at the prep station." },
      { n: "02", t: "Accumulate", d: "The dancer banks web so the line never starves during the change." },
      { n: "03", t: "Splice", d: "At roll-end, the new web is joined at zero relative speed." },
      { n: "04", t: "Run on", d: "The expired core ejects; the line never stopped." },
    ],
    apps: ["Sheeting lines", "Slitting", "Printing", "Coating & laminating"],
    proof: {
      stat: "0 stops",
      label: "Roll changes without a line stop",
      quote: "Zero-speed splicing converts changeover downtime into continuous runtime.",
    },
    partsCat: "Hydraulic",
    downloads: [{ t: "Spec sheet (PDF)", m: "Web widths & control" }],
  },

  "JME-DC-04": {
    tagline: "Take the curl out of the roll before it hits the knife.",
    lead: "The JME Decurler removes residual roll-set curl ahead of the sheeter so stacks lie flat and square. Adjustable decurl bars mount inline and add no separate drive.",
    heroStats: [
      { value: "to 1650 mm", label: "Web width" },
      { value: "Inline", label: "Mounting" },
      { value: "Adj.", label: "Decurl bars" },
    ],
    badge: { status: "lead", label: "JME Build / Quote" },
    gallery: [],
    basePrice: 12800,
    options: [
      {
        id: "width",
        label: "Web width",
        type: "radio",
        choices: [
          { v: "1650 mm", sku: "W65", price: 0, note: "Standard" },
          { v: "1900 mm", sku: "W75", price: 2600 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Quick-release bars", sku: "QR", price: 900 },
          { v: "Operator scale / indicator", sku: "SC", price: 600 },
        ],
      },
    ],
    how: [
      { n: "01", t: "Thread", d: "Web routes over a set of adjustable decurl bars." },
      { n: "02", t: "Set", d: "Operator dials in wrap angle to counter the roll-set curl." },
      { n: "03", t: "Flatten", d: "The web exits flat, feeding cleaner into the sheeter." },
      { n: "04", t: "Stack", d: "Flatter sheets pile into squarer, more salable stacks." },
    ],
    apps: ["Sheeting lines", "Cut-size", "Specialty stock"],
    proof: {
      stat: "Flatter",
      label: "Squarer stacks, less rework",
      quote: "Removing curl upstream cuts jam rates and improves stack quality at the piler.",
    },
    partsCat: "Sheeter",
    downloads: [{ t: "Spec sheet (PDF)", m: "Mounting & width" }],
  },
};
