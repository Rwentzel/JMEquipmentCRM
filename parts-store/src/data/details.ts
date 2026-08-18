import type { MachineDetail } from "./types";

/**
 * Per-machine deep content for /machine/[sku]. Sandbox demo data, RFQ-first.
 * Configurator options carry NO prices — selections build an RFQ spec only.
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
    badge: { band: "Quote Required" },
    gallery: [
      { src: "core-splitter.png", cap: "Full machine — 75″ frame", fit: "contain" },
      { src: "core-splitter-pump.png", cap: "Hydraulic power pack — 5 HP", fit: "contain" },
    ],
    options: [
      {
        id: "power",
        label: "Power",
        type: "radio",
        choices: [
          { v: "5 HP / 230V 1Ø", sku: "P1", note: "Standard" },
          { v: "5 HP / 230V 3Ø", sku: "P3" },
          { v: "5 HP / 460V 3Ø", sku: "P4" },
        ],
      },
      {
        id: "frame",
        label: "Frame height",
        type: "radio",
        choices: [
          { v: "75 in (12″ head)", sku: "F75", note: "Standard" },
          { v: "90 in (16″ head)", sku: "F90", note: "Extended" },
        ],
      },
      {
        id: "guard",
        label: "Guarding",
        type: "radio",
        choices: [
          { v: "Mesh cage + interlock", sku: "G1", note: "Standard" },
          { v: "Light curtain", sku: "G2" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Crating for freight", sku: "CR", note: "Recommended" },
          { v: "Spare blade set (4)", sku: "SB" },
          { v: "Discharge chute", sku: "DC" },
          { v: "Casters + leveling feet", sku: "CF" },
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
      stat: "~13 mo",
      label: "Typical payback",
      quote:
        "Based on roughly 30 cores/day over 250 days/year versus dumpster haul — about a 13-month payback. Estimates only, not a financial guarantee; figures confirmed for your operation on request.",
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
      { value: "400–1650 mm", label: "Web width" },
      { value: "350 m/min", label: "Cutting curve" },
      { value: "1000 gsm", label: "Knife loading" },
    ],
    badge: { band: "Quote Required" },
    gallery: [
      { src: "sheeter-1650.jpg", cap: "GMC-TCII 1650 sheeting line", fit: "cover" },
      { src: "sheeter-1600e.jpg", cap: "GMC-TCII 1600-E variant", fit: "cover" },
    ],
    options: [
      {
        id: "width",
        label: "Trim width",
        type: "radio",
        choices: [
          { v: "1650 mm (65 in)", sku: "W65", note: "Standard" },
          { v: "1600 mm (63 in) E", sku: "W63", note: "Economy" },
          { v: "1900 mm (75 in)", sku: "W75" },
        ],
      },
      {
        id: "webs",
        label: "Web stations",
        type: "radio",
        choices: [
          { v: "2 web", sku: "B2", note: "Standard" },
          { v: "4 web", sku: "B4" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Tidland-style slitters", sku: "SL" },
          { v: "Motorized decurler", sku: "DC" },
          { v: "Overlap / shingle table", sku: "OL" },
          { v: "Non-stop pallet change", sku: "NS" },
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

  "GMC-1600E": {
    tagline: "The proven Goodstrong platform, right-sized — dual rotary sheeting without the flagship options.",
    lead: "The 1600-E carries the same dual rotary knife section and factory-direct support as the 1650, in a simpler package for shops stepping up from a single-knife or aging used sheeter. Quoted, installed, and parts-supported from Sturgis.",
    heroStats: [
      { value: "1600 mm", label: "Web width" },
      { value: "Dual", label: "Rotary knives" },
      { value: "Sturgis", label: "Support base" },
    ],
    badge: { band: "Quote Required" },
    gallery: [
      { src: "sheeter-1600e.jpg", cap: "GMC 1600-E dual rotary sheeter", fit: "cover" },
      { src: "sheeter-1650.jpg", cap: "1650 flagship variant", fit: "cover" },
    ],
    options: [
      {
        id: "webs",
        label: "Web stations",
        type: "radio",
        choices: [
          { v: "1 web", sku: "B1", note: "Standard" },
          { v: "2 web", sku: "B2" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Slitter section", sku: "SL" },
          { v: "Overlap / shingle table", sku: "OL" },
          { v: "Stacker upgrade", sku: "ST" },
        ],
      },
    ],
    how: [
      { n: "01", t: "Unwind", d: "A rollstand feeds the web under tension into the sheeter bridge." },
      { n: "02", t: "Slit", d: "Optional slitters trim the web to finished width." },
      { n: "03", t: "Cut", d: "Dual rotary knives cut clean sheet lengths at speed." },
      { n: "04", t: "Stack", d: "Overlap and stacker sections deliver square piles for offload." },
    ],
    apps: ["Cut-size paper", "Folding carton", "School & office converting", "Board & liner"],
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

  "JME-LD-12": {
    tagline: "Out-of-round rolls put tension spikes in your web. The dancer takes them back out.",
    lead: "The JME Linear Dancer is an accumulator-style tension system custom-designed for your converting line. A 12-inch precision-balanced dead-shaft aluminum dancer roll rides on a pneumatic load system with electronic pressure control and position feedback, absorbing the tension fluctuations that out-of-round and eccentric rolls throw into the web — the fluctuations that show up downstream as short sheets, length variation, and beaten-up knives.",
    heroStats: [
      { value: "1,500 FPM", label: "Web speed" },
      { value: "0.5–50 PLI", label: "Tension range" },
      { value: "< 0.3 s", label: "Dynamic response" },
    ],
    badge: { band: "Quote Required" },
    gallery: [],
    options: [
      {
        id: "width",
        label: "Web width",
        type: "radio",
        choices: [
          { v: "To 40 in", sku: "W40" },
          { v: "40–63 in", sku: "W63", note: "Common" },
          { v: "Over 63 in", sku: "W63P" },
        ],
      },
      {
        id: "integration",
        label: "Line integration",
        type: "radio",
        choices: [
          { v: "Ahead of sheeter", sku: "IS", note: "Most common" },
          { v: "Ahead of slitter / laminator", sku: "IL" },
          { v: "Other (describe in notes)", sku: "IO" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Position feedback display", sku: "PF" },
          { v: "Spare dancer roll", sku: "SR" },
          { v: "Commissioning on site", sku: "CM", note: "Recommended" },
        ],
      },
    ],
    how: [
      { n: "01", t: "Survey", d: "JME engineers the mounting frame and geometry around your web width, speed range, and existing machine interfaces." },
      { n: "02", t: "Absorb", d: "The dancer roll strokes with each tension spike, accumulating and releasing web instead of passing the jolt downstream." },
      { n: "03", t: "Regulate", d: "The E/P transducer and position sensor hold set tension across the 0.5–50 PLI range in under 0.3 seconds." },
      { n: "04", t: "Cut clean", d: "Steadier web in — consistent sheet lengths out, with less shock load on the sheeter knives." },
    ],
    apps: ["Sheeting lines", "Fine paper mills", "Web processors", "Laminators", "Slitting"],
    proof: {
      stat: "40–60%",
      label: "Short-sheet waste reduction",
      quote:
        "On lines fighting out-of-round rolls, accumulator dancers typically cut short-sheet waste 40–60% and hold length consistency to ±0.010 in. Figures from JME application engineering — confirmed against your line during the survey.",
    },
    partsCat: "Edge Guide & Tension",
    downloads: [
      { t: "Application worksheet", m: "Web width, speeds, roll condition" },
      { t: "Integration drawing (sample)", m: "Mounting frame & clearances" },
    ],
  },

  "JME-RR-16": {
    tagline: "The right rollstand at the right price — 7,000 lb rolls handled without a core shaft or a strained back.",
    lead: "The RollRite is JME's shaftless dual-position pivoting-arm rollstand. Hydraulic lift arms and the standard E-Z Load side-shifting trolley put 7,000 lb, 83-inch parent rolls on the line without manual shaft handling; closed-loop tension control and a pressure-regulated pneumatic brake keep the web steady into slitters, sheeters, bag machines, presses, and laminators. Built new and parts-backed in Sturgis, Michigan.",
    heroStats: [
      { value: "7,000 lb", label: "Roll capacity" },
      { value: "83 in", label: "Max roll dia." },
      { value: "63 in", label: "Max web width" },
    ],
    badge: { band: "Quote Required" },
    gallery: [{ src: "rollrite-gmc.jpg", cap: "GMC-built shaftless pivot-arm unwind — the RollRite platform", fit: "cover" }],
    options: [
      {
        id: "core",
        label: "Core size",
        type: "radio",
        choices: [
          { v: "4 in", sku: "C4", note: "Standard" },
          { v: "3–6 in", sku: "C36" },
          { v: "10–12 in", sku: "C1012" },
          { v: "16 in", sku: "C16" },
        ],
      },
      {
        id: "chuck",
        label: "Chucks",
        type: "radio",
        choices: [
          { v: "Standard", sku: "CS", note: "Standard" },
          { v: "Custom", sku: "CC" },
        ],
      },
    ],
    how: [
      { n: "01", t: "Load", d: "The E-Z Load side-shifting trolley positions the parent roll; hydraulic arms lift it — no core shaft, no crane." },
      { n: "02", t: "Chuck", d: "Quick-change chucks (3–6 / 10–12 in, 8 / 16 in adaptors) grip the core; split-roll capable." },
      { n: "03", t: "Tension", d: "Closed-loop control and the pneumatic brake hold steady web tension as the line pulls." },
      { n: "04", t: "Feed", d: "Controlled delivery into the slitter, sheeter, bag machine, press, or laminator — brake auto-engages on power loss." },
    ],
    apps: ["Slitters", "Sheeters", "Bag machines", "Forming presses", "Laminators"],
    proof: {
      stat: "JME",
      label: "Built for converters",
      quote:
        "Sold, supported, and parts-backed from one floor in Sturgis, Michigan.",
    },
    partsCat: "Rollstand",
    downloads: [],
  },

  "GMM-RS-RB": {
    tagline: "Rebuilt Geo M. Martin rollstands — feed any line with OEM+ confidence.",
    lead: "A rollstand sits behind your slitter, sheeter, die cutter, or corrugator to feed parent rolls smoothly under tension. JME rebuilds Geo M. Martin stands to tighter-than-original spec, media-blasts and repaints to your color, and pressure-tests before it ships — and stocks Martin repair parts like brake components, hydraulic filters, and alignment blocks.",
    heroStats: [
      { value: "4–16 in", label: "Core range" },
      { value: "OEM+", label: "Rebuild spec" },
      { html: "150<em>%</em>", label: "Test pressure" },
    ],
    badge: { band: "Quote Required" },
    gallery: [{ src: "martin-rollstand.jpg", cap: "Geo M. Martin rollstand — rebuilt in the JME shop, Sturgis MI", fit: "cover" }],
    options: [
      {
        id: "chuck",
        label: "Chucks",
        type: "radio",
        choices: [
          { v: "Ribbed expanding", sku: "CR", note: "Standard" },
          { v: "Mechanical expanding", sku: "CM" },
          { v: "Air-shaft", sku: "CA" },
        ],
      },
      {
        id: "brake",
        label: "Brake",
        type: "radio",
        choices: [
          { v: "Pneumatic", sku: "BP", note: "Standard" },
          { v: "Magnetic-particle", sku: "BM" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Powered web guide", sku: "WG" },
          { v: "Load/unload arms", sku: "LA" },
          { v: "Custom paint to brand color", sku: "PT" },
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
    badge: { band: "Quote Required" },
    gallery: [],
    options: [
      {
        id: "width",
        label: "Cut width",
        type: "radio",
        choices: [
          { v: "42 in", sku: "C42", note: "Standard" },
          { v: "52 in", sku: "C52" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Air table", sku: "AT" },
          { v: "Backgauge memory", sku: "BG" },
          { v: "Side tables", sku: "ST" },
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
    badge: { band: "Quote Required" },
    gallery: [],
    options: [
      {
        id: "width",
        label: "Web width",
        type: "radio",
        choices: [
          { v: "1650 mm", sku: "W65", note: "Standard" },
          { v: "1900 mm", sku: "W75" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Turret unwind", sku: "TU" },
          { v: "Splice-detect sensor", sku: "SD" },
          { v: "Dancer tension control", sku: "DT" },
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
    lead: "The JME Decurler uses multi-bar decurl to flatten rolls at any width, at the speed your line needs. It can be crafted to mount onto any sheeter, and installation is easy with interchangeable decurler bearings and cradle rollers.",
    heroStats: [
      { value: "Any width", label: "Multi-bar decurl" },
      { value: "Any sheeter", label: "Custom mounting" },
      { value: "Easy", label: "Install & service" },
    ],
    badge: { band: "Quote Required" },
    gallery: [],
    options: [
      {
        id: "width",
        label: "Web width",
        type: "radio",
        choices: [
          { v: "1650 mm", sku: "W65", note: "Standard" },
          { v: "1900 mm", sku: "W75" },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "check",
        choices: [
          { v: "Quick-release bars", sku: "QR" },
          { v: "Operator scale / indicator", sku: "SC" },
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
    partsCat: "Decurler",
    downloads: [{ t: "Spec sheet (PDF)", m: "Mounting & width" }],
  },
};
