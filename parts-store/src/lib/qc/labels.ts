/**
 * JME Quote Center — client-safe display constants.
 *
 * Terms boilerplate, ROI disclosures, and loss-reason labels. These are the
 * ONLY Quote Center constants that may reach the browser bundle, so they live
 * apart from ./data.ts, which holds dealer pricing and seeded client records.
 * Keep it that way: anything with a price, cost, margin, or customer name
 * belongs in ./data.ts (server-only), never here.
 */

export const TERM_TPL: { t: string; d: string }[] = [
    {t:'Quotation Validity',d:'This quotation is valid for {VALIDITY} calendar days from the date of issue. Prices are in USD.'},
    {t:'Equipment Condition',d:'Equipment is sold as specified. Refurbished units per JME condition report; new units per OEM specification.'},
    {t:'FOB Terms',d:'All shipments are FOB {FOB} unless otherwise agreed in writing.'},
    {t:'Warranty Coverage',d:'New JME-manufactured equipment: 1 year. Goodstrong new equipment: 12 months. Martin refurbished: 6 months.'},
    {t:'Warranty Exclusions',d:'Warranty does not cover normal wear, consumables, misuse, unauthorized repair, or modification.'},
    {t:'Freight & Tariffs',d:'Freight and import duties are buyer responsibility unless stated. Tariff rates reflect the rate at time of quote and are subject to change.'},
    {t:'Governing Law',d:'This agreement is governed by the laws of the State of Michigan, United States.'},
    {t:'Acceptance',d:'Equipment ordered or PO issued constitutes acceptance of these terms and conditions.'},
  ];

export const DISCLOSURES: string[] = [
    'Electrical installation: $500\u2013$1,500 (buyer responsibility, not included in quote).',
    'Annual operating cost: $410\u2013$830 (electric, oil, blades, filters).',
    'Site preparation and installation guidance available; on-site install not included.',
    'Freight subject to change. Tariff amounts reflect rate at time of quote; final invoicing per current rate.',
  ];

export const LOSS_REASONS: string[] = ['Price','Lead time','Lost to competitor','Budget / timing','Project cancelled','No decision','Other'];
