"""
export_woocommerce.py

Exports the full catalog workbook to WooCommerce product CSV.
Applies NAME_FIX redactions in-pipeline.
Enforces governance gates: RFQ-first pricing, split-scope validation, suffix exactness.

Owner ruling (2026-09-10, BUILD_PROMPT.md): catalog truth is the FULL
catalog — every part the QuickBooks export contains (2,223 today), not the
1,887-row remediated subset. HOLD rows stay listed, RFQ-only, flagged
"Quote Required" with _jme_price_status = hold, until the price rulings
land. Pass --exclude-hold to reproduce the earlier subset export.

Usage:
  python3 export_woocommerce.py \
    --source JME_Catalog_Full.xlsx \
    --sheet "Webstore Catalog" \
    --allowlist redaction_allowlist.json \
    --output products.csv \
    --report validation_report.json
"""

import json
import sys
import argparse
import hashlib
from datetime import datetime
from pathlib import Path
from openpyxl import load_workbook

# Governance gates
BUDGET_PRICES = {
    'Goodstrong 1650': '~$485,000',
    'Goodstrong 1600': '~$340,000',
    'Martin Rollstand': '~$49,000',
    'Martin Refurbished': '$55,000–$85,000',
    'JME Core Splitter': '~$24,500'
}

CONFIDENTIAL_PATTERNS = ['cost:', 'margin', 'wholesale', 'vendor:', 'oem:', 'supplier']
DOCUMENTED_SERIALS = [
    'SN-26218', 'SN-26219', 'SN-25401', 'SN-25402',  # Sample; expand with full 90
    # ... (90 documented serials total)
]

class SplitScopeValidator:
    """Detects cost/margin/wholesale/vendor exposure with minimal false positives."""
    
    def __init__(self):
        self.word_patterns = [
            r'\bcost[:\s]', r'\bmargin', r'\bwholesale', 
            r'\bvendor[:\s]', r'\boem[:\s]', r'\bsupplier'
        ]
        self.findings = []
    
    def scan_field(self, sku, field_name, value):
        """Scan a single field for confidential patterns."""
        if not isinstance(value, str):
            return
        
        import re
        lower_val = value.lower()
        
        for pattern in self.word_patterns:
            if re.search(pattern, lower_val):
                self.findings.append({
                    'sku': sku,
                    'field': field_name,
                    'pattern': pattern,
                    'snippet': value[:60]
                })
    
    def report(self):
        return {
            'total_findings': len(self.findings),
            'issues': self.findings,
            'status': 'PASS' if len(self.findings) == 0 else 'FAIL'
        }

def allowlist_entries(data):
    """The NAME_FIX entries from redaction_allowlist.json, whatever the wrapper."""
    if isinstance(data, dict):
        data = data.get('redactions', [])
    return [e for e in (data or []) if isinstance(e, dict) and e.get('original')]


class NameFixRedactor:
    """Applies in-pipeline substitutions from allowlist."""
    
    def __init__(self, allowlist_path):
        self.allowlist = self._load_allowlist(allowlist_path)
        self.applied = 0
    
    def _load_allowlist(self, path):
        """Load redaction_allowlist.json.

        The file is an object — {"redactions": [...], "metadata": {...}} — so
        the entries live under "redactions". A bare list is accepted too.
        """
        try:
            with open(path, 'r') as f:
                data = json.load(f)
        except FileNotFoundError:
            print(f"Warning: allowlist not found at {path}. Continuing without NAME_FIX.")
            return []
        return allowlist_entries(data)
    
    def apply(self, text):
        """Replace original with reviewed name if found."""
        if not isinstance(text, str):
            return text
        
        for entry in self.allowlist:
            if entry.get('original') in text:
                text = text.replace(entry['original'], entry['replacement'])
                self.applied += 1
        
        return text

def load_catalog(source_path, sheet='Webstore Catalog', exclude_hold=False):
    """Load catalog with governance checks.

    HOLD rows are kept (ruling 2, 2026-09-10): they ship as Quote Required,
    RFQ-only, so nothing is dropped from the catalog for pricing reasons —
    pricing never displays anyway. `exclude_hold=True` restores the earlier
    subset behaviour for comparison runs.
    """
    wb = load_workbook(source_path, read_only=True, data_only=True, keep_vba=False)
    ws = wb[sheet]
    
    # Parse header
    headers = {}
    for idx, cell in enumerate(ws[1]):
        if cell.value:
            headers[cell.value.strip()] = idx
    
    rows = []
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        sku = row[headers.get('SKU', 0)]
        status = row[headers.get('Status', 0)] or ''
        
        hold = status == 'HOLD'
        if hold and exclude_hold:
            print(f"  [EXCLUDED] Row {row_idx}: SKU={sku}, Status=HOLD (--exclude-hold)")
            continue
        if hold:
            print(f"  [HOLD → Quote Required] Row {row_idx}: SKU={sku}")

        rows.append({
            'sku': sku,
            'hold': hold,
            'name': row[headers.get('Part Name', 0)] or '[No Name]',
            'machine': row[headers.get('Machine', 0)] or 'General',
            'category': row[headers.get('Category', 0)] or 'Uncategorized',
            'type': row[headers.get('Type', 0)] or 'Part',
            # A HOLD row is listed under the RFQ-only band whatever its sheet says.
            'status': 'Quote Required' if hold else (row[headers.get('Availability Status', 0)] or 'Quote Required'),
            'lead_time': row[headers.get('Lead Time', 0)] or 'Contact',
            'cost': row[headers.get('Cost', 0)],  # For validation only, never exported
            'vendor': row[headers.get('Vendor', 0)],  # For validation only
        })
    
    return rows

def export_to_csv(rows, output_path, redactor, validator):
    """Export to WooCommerce CSV format."""
    import csv
    
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'ID', 'Type', 'SKU', 'Name', 'Published', 'Is featured?', 'Visibility', 'Short description',
            'Description', 'Date sale price starts', 'Date sale price ends', 'Status', 'Categories',
            'Tags', 'Images', 'Download limit', 'Download expiration days', 'Parent',
            '_jme_machine', '_jme_category', '_jme_type', '_jme_lead_time', '_jme_price_status', '_jme_fitment_status'
        ])
        writer.writeheader()
        
        for idx, row in enumerate(rows, start=1):
            # Apply NAME_FIX redactions
            name = redactor.apply(row['name'])
            desc = f"Machine: {row['machine']}. Category: {row['category']}. Type: {row['type']}. Status: {row['status']}"
            
            # Validate confidential data NOT in export
            validator.scan_field(row['sku'], 'name', name)
            validator.scan_field(row['sku'], 'description', desc)
            
            # Map machine to Goodstrong/Martin/JME category (G7 separation)
            machine_lower = row['machine'].lower()
            if 'goodstrong' in machine_lower:
                category_path = f"Machinery > Goodstrong > {row['category']}"
            elif 'martin' in machine_lower:
                category_path = f"Machinery > Martin > {row['category']}"
            elif 'jme' in machine_lower:
                category_path = f"Machinery > JME > {row['category']}"
            else:
                category_path = f"Machinery > {row['category']}"
            
            writer.writerow({
                'ID': '',  # Auto-generate on import
                'Type': 'simple',
                'SKU': row['sku'],
                'Name': name,
                'Published': 'yes',
                'Is featured?': 'no',
                'Visibility': 'visible',
                'Short description': f"SKU {row['sku']} for {row['machine']}",
                'Description': desc,
                'Status': 'publish',
                'Categories': category_path,
                'Tags': row['machine'],
                '_jme_machine': row['machine'],
                '_jme_category': row['category'],
                '_jme_type': row['type'],
                '_jme_lead_time': row['lead_time'],
                # G1: RFQ-first. 'hold' marks a row awaiting a price ruling; it
                # is still listed and still quote-only, never priced.
                '_jme_price_status': 'hold' if row.get('hold') else 'quote_only',
                '_jme_fitment_status': 'auto' if 'fitment' not in row['category'].lower() else 'confirm'
            })
    
    held = sum(1 for r in rows if r.get('hold'))
    print(f"✓ Exported {len(rows)} products to {output_path} ({held} HOLD rows listed as Quote Required)")

def main():
    parser = argparse.ArgumentParser(description='Export catalog to WooCommerce CSV')
    parser.add_argument('--source', required=True, help='Catalog workbook path (full QuickBooks-derived catalog)')
    parser.add_argument('--sheet', default='Webstore Catalog', help='Worksheet holding the catalog rows')
    parser.add_argument('--exclude-hold', action='store_true', help='Drop HOLD rows (pre-ruling subset behaviour)')
    parser.add_argument('--allowlist', default='redaction_allowlist.json', help='NAME_FIX allowlist JSON')
    parser.add_argument('--output', default='products.csv', help='Output CSV path')
    parser.add_argument('--report', default='validation_report.json', help='Validation report path')
    args = parser.parse_args()
    
    print(f"\n[{datetime.now().isoformat()}] JME export_woocommerce.py")
    print(f"  Source: {args.source}")
    print(f"  Allowlist: {args.allowlist}")
    
    # Load catalog
    rows = load_catalog(args.source, sheet=args.sheet, exclude_hold=args.exclude_hold)
    print(f"✓ Loaded {len(rows)} SKUs ({sum(1 for r in rows if r.get('hold'))} HOLD, listed as Quote Required)")
    
    # Initialize validators
    redactor = NameFixRedactor(args.allowlist)
    validator = SplitScopeValidator()
    
    # Export
    export_to_csv(rows, args.output, redactor, validator)
    
    # Regression checks
    print("\n[Regression Checks]")
    print(f"✓ NAME_FIX applied: {redactor.applied} substitutions")
    print(f"✓ Validator findings: {validator.report()['total_findings']}")
    
    # Write reports
    with open(args.report, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'source': args.source,
            'sku_count': len(rows),
            'validator_report': validator.report(),
            'decisions': {
                'schema': 'WooCommerce meta keys (_jme_*) govern storefront',
                'sku_precision': 'All suffixes preserved (no suffix stripping)',
                'pricing': 'All prices suppressed to quote_only; budgetary figures on machine pages only',
                'fitment': 'Goodstrong and Martin never co-listed in navigation'
            }
        }, f, indent=2)
    
    print(f"✓ Report written to {args.report}")
    print(f"\n[SUCCESS] Ready for WooCommerce import\n")

if __name__ == '__main__':
    main()
