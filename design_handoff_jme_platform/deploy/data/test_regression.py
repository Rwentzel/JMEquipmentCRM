"""
test_regression.py

Regression suite for JME platform builds.
Ensures governance gates pass and exports are byte-idempotent.

Usage:
  python3 test_regression.py \
    --artifact products.csv \
    --expect-sku-count 2223 \
    --expect-hold-count 10 \
    --idempotence-test

Owner ruling (2026-09-10, BUILD_PROMPT.md): the export carries the FULL
catalog (2,223 today). HOLD SKUs are present, flagged _jme_price_status =
hold and listed as Quote Required — EG-1 now checks they are flagged, not
that they are absent.
"""

import csv
import json
import hashlib
import argparse
from datetime import datetime

class RegressionSuite:
    
    def __init__(self, artifact_path):
        self.artifact = artifact_path
        self.results = []
        self.skus = set()
        self.hold_count = 0
        self.findings = []
    
    def load_artifact(self):
        """Load CSV and parse."""
        try:
            with open(self.artifact, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            print(f"✓ Loaded {len(rows)} rows from {self.artifact}")
            return rows
        except Exception as e:
            print(f"✗ Failed to load artifact: {e}")
            return None
    
    def test_sku_count(self, rows, expected_count):
        """G1: Verify expected SKU count (import-eligible)."""
        actual = len(rows)
        status = 'PASS' if actual == expected_count else 'FAIL'
        self.results.append({
            'test': 'sku_count',
            'expected': expected_count,
            'actual': actual,
            'status': status
        })
        print(f"  [{status}] SKU count: {actual} == {expected_count}")
        return status == 'PASS'
    
    def test_hold_skus_flagged(self, rows, expected_hold):
        """EG-1: HOLD SKUs are present, flagged hold, and listed as Quote Required.

        Nothing is dropped from the catalog for pricing reasons; a HOLD row is
        RFQ-only like every other row, and the flag is what the Governance
        Console's HOLD queue reads.
        """
        held = [r for r in rows if r.get('_jme_price_status') == 'hold']
        self.hold_count = len(held)
        unlabelled = [r.get('SKU') for r in held if 'Quote Required' not in (r.get('Description') or '')]
        status = 'PASS' if self.hold_count == expected_hold and not unlabelled else 'FAIL'
        self.results.append({
            'test': 'hold_skus_flagged',
            'expected': expected_hold,
            'hold_found': self.hold_count,
            'hold_unlabelled': len(unlabelled),
            'status': status
        })
        print(f"  [{status}] HOLD SKUs flagged: {self.hold_count} == {expected_hold}, unlabelled: {len(unlabelled)} == 0")
        if unlabelled:
            self.findings.extend({'sku': sku, 'issue': 'HOLD row not listed as Quote Required'} for sku in unlabelled)
        return status == 'PASS'
    
    def test_name_fix_applied(self, rows, allowlist_path):
        """EG-2: Verify no original (pre-redaction) names in export."""
        try:
            with open(allowlist_path, 'r') as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            print(f"  [SKIP] Allowlist not found")
            return True
        # The file is {"redactions": [...], "metadata": {...}}; accept a bare list too.
        allowlist = data.get('redactions', []) if isinstance(data, dict) else (data or [])
        allowlist = [e for e in allowlist if isinstance(e, dict) and e.get('original')]
        
        originals_found = []
        for row in rows:
            name = row.get('Name', '')
            for entry in allowlist:
                if entry.get('original') in name:
                    originals_found.append({
                        'sku': row.get('SKU'),
                        'original': entry['original'],
                        'in_field': 'Name'
                    })
        
        status = 'PASS' if len(originals_found) == 0 else 'FAIL'
        self.results.append({
            'test': 'name_fix_applied',
            'originals_found': len(originals_found),
            'status': status
        })
        print(f"  [{status}] NAME_FIX originals absent: {len(originals_found)} == 0")
        if originals_found:
            self.findings.extend(originals_found)
        return status == 'PASS'
    
    def test_no_blank_names(self, rows):
        """G10: No blank part names."""
        blanks = [r.get('SKU') for r in rows if not r.get('Name') or r.get('Name').strip() == '']
        status = 'PASS' if len(blanks) == 0 else 'FAIL'
        self.results.append({
            'test': 'no_blank_names',
            'blanks_found': len(blanks),
            'status': status
        })
        print(f"  [{status}] Blank names: {len(blanks)} == 0")
        return status == 'PASS'
    
    def test_no_confidential_data(self, rows):
        """G2: Split-scope validator — no cost/vendor/margin/wholesale in payload."""
        patterns = ['cost:', 'margin', 'wholesale', 'vendor:', 'oem:', 'supplier']
        violations = []
        
        for row in rows:
            for field in ['Name', 'Description', 'Short description']:
                val = row.get(field, '').lower()
                for pattern in patterns:
                    if pattern in val:
                        violations.append({
                            'sku': row.get('SKU'),
                            'field': field,
                            'pattern': pattern
                        })
        
        status = 'PASS' if len(violations) == 0 else 'FAIL'
        self.results.append({
            'test': 'no_confidential_data',
            'violations': len(violations),
            'status': status
        })
        print(f"  [{status}] Confidential data absent: {len(violations)} == 0")
        return status == 'PASS'
    
    def test_suffix_precision(self, rows):
        """G5: No suffix stripping. Verify canary pairs distinct."""
        # Canary pairs (must be present as distinct SKUs or absent together)
        canaries = [
            ('MB2G2011011', 'MB2G2011011-OR'),  # cylinder vs seal kit
            ('TBD-UCFLANGE', 'TBD-UCFLANGELESS')  # flange vs flangeless
        ]
        
        skus = set(r.get('SKU') for r in rows)
        violations = []
        
        for sku1, sku2 in canaries:
            has_1 = sku1 in skus
            has_2 = sku2 in skus

            # Both absent or both present = OK; one without the other = FAIL
            if has_1 != has_2:
                violations.append({
                    'pair': [sku1, sku2],
                    'has_base': has_1,
                    'has_variant': has_2,
                    'issue': 'Suffix may have been stripped or variants split incorrectly'
                })
        
        status = 'PASS' if len(violations) == 0 else 'FAIL'
        self.results.append({
            'test': 'suffix_precision',
            'canary_violations': len(violations),
            'status': status
        })
        print(f"  [{status}] Suffix canaries: {len(violations)} violations == 0")
        return status == 'PASS'
    
    def test_goodstrong_martin_separation(self, rows):
        """G7: Goodstrong and Martin never co-listed in categories."""
        violations = []
        
        for row in rows:
            categories = row.get('Categories', '').lower()
            has_goodstrong = 'goodstrong' in categories
            has_martin = 'martin' in categories
            
            if has_goodstrong and has_martin:
                violations.append({
                    'sku': row.get('SKU'),
                    'categories': row.get('Categories'),
                    'issue': 'Goodstrong and Martin in same category path'
                })
        
        status = 'PASS' if len(violations) == 0 else 'FAIL'
        self.results.append({
            'test': 'goodstrong_martin_separation',
            'violations': len(violations),
            'status': status
        })
        print(f"  [{status}] Goodstrong/Martin separation: {len(violations)} violations == 0")
        return status == 'PASS'
    
    UNPRICED = ('quote_only', 'hold')

    def test_price_suppression(self, rows):
        """G1: Verify every row is unpriced — quote_only, or hold (listed, awaiting a ruling)."""
        non_quote = sum(1 for r in rows if r.get('_jme_price_status') not in self.UNPRICED)
        status = 'PASS' if non_quote == 0 else 'FAIL'
        self.results.append({
            'test': 'price_suppression',
            'non_quote_only': non_quote,
            'status': status
        })
        print(f"  [{status}] Price suppression: {non_quote} priced rows == 0")
        return status == 'PASS'
    
    def test_idempotence(self, artifact2_path=None):
        """Build idempotence: two runs must produce byte-identical output."""
        if not artifact2_path:
            print(f"  [SKIP] No second artifact provided for idempotence check")
            return True
        
        try:
            with open(self.artifact, 'rb') as f1, open(artifact2_path, 'rb') as f2:
                hash1 = hashlib.md5(f1.read()).hexdigest()
                hash2 = hashlib.md5(f2.read()).hexdigest()
            
            status = 'PASS' if hash1 == hash2 else 'FAIL'
            self.results.append({
                'test': 'idempotence',
                'hash1': hash1,
                'hash2': hash2,
                'status': status
            })
            print(f"  [{status}] Idempotence: {hash1} == {hash2}")
            return status == 'PASS'
        except Exception as e:
            print(f"  [ERROR] Idempotence test failed: {e}")
            return False
    
    def report(self):
        """Summarize all tests."""
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        total = len(self.results)
        
        print(f"\n[Regression Report]")
        print(f"  {passed}/{total} tests passed")
        
        all_pass = passed == total
        print(f"\n  Overall: {'✓ PASS' if all_pass else '✗ FAIL'}")
        
        if self.findings:
            print(f"\n[Findings]")
            for finding in self.findings[:10]:  # Show first 10
                print(f"  - {finding}")
        
        return all_pass

def main():
    parser = argparse.ArgumentParser(description='Regression test suite')
    parser.add_argument('--artifact', required=True, help='Artifact CSV to test')
    parser.add_argument('--artifact2', help='Second artifact for idempotence check')
    parser.add_argument('--expect-sku-count', type=int, default=2223, help='Full catalog row count')
    parser.add_argument('--expect-hold-count', type=int, default=10, help='HOLD rows present and flagged')
    parser.add_argument('--allowlist', default='redaction_allowlist.json')
    args = parser.parse_args()
    
    print(f"\n[{datetime.now().isoformat()}] JME Regression Suite")
    
    suite = RegressionSuite(args.artifact)
    rows = suite.load_artifact()
    if not rows:
        print("✗ ABORT: Could not load artifact")
        sys.exit(1)
    
    print("\n[Running Tests]")
    suite.test_sku_count(rows, args.expect_sku_count)
    suite.test_hold_skus_flagged(rows, args.expect_hold_count)
    suite.test_name_fix_applied(rows, args.allowlist)
    suite.test_no_blank_names(rows)
    suite.test_no_confidential_data(rows)
    suite.test_suffix_precision(rows)
    suite.test_goodstrong_martin_separation(rows)
    suite.test_price_suppression(rows)
    if args.artifact2:
        suite.test_idempotence(args.artifact2)
    
    all_pass = suite.report()
    sys.exit(0 if all_pass else 1)

if __name__ == '__main__':
    import sys
    main()
