#!/usr/bin/env python3
"""
JME public parts catalog generator.

Reads the PRIVATE parts export (parts-data.ts produced by the staff
QuickBooks sync — keep it OUTSIDE this repository) and writes:
  1. src/data/partsCatalog.ts  — PUBLIC-SAFE catalog: JME web reference
     numbers, scrubbed descriptions, availability bands. Never vendor/OEM
     part numbers, prices, quantities, or vendor names as sources.
  2. crosswalk.csv (PRIVATE)   — web ref -> real part number, price, stock.
     Store in the private JME Drive. NEVER commit this file.

Usage:
  python3 generate-public-catalog.py <parts-data.ts> <out-crosswalk.csv>

The web reference sequence is deterministic (sorted by family, category,
part number), so re-running on the same export yields identical refs.
"""
import json, re, csv, sys
from collections import Counter

if len(sys.argv) != 3:
    sys.exit(__doc__)
SRC, OUT_XW = sys.argv[1], sys.argv[2]
OUT_TS = __file__.rsplit('/scripts/', 1)[0] + '/src/data/partsCatalog.ts'

c = open(SRC).read()

CATEGORIES = json.loads(re.search(r'CATEGORIES[^=]*=\s*(\{.*?\});', c, re.S).group(1).replace('\\"', '"'))
row_re = re.compile(r'\["((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)","([\d.]+)",\s*([\d.]+|null)\s*,\s*(-?\d+)\s*\]')
rows = row_re.findall(c)
assert rows, 'no part rows parsed — is this the QuickBooks parts-data.ts export?'

def unesc(s): return s.replace('\\"', '"')

DIM_ONLY = re.compile(r'^[\d\s./xX*-]+$')
def codelike(t):
    t = t.strip()
    return (len(t) >= 5 and any(ch.isdigit() for ch in t) and not DIM_ONLY.match(t)
            and any(ch.isalpha() for ch in t)) or (len(t) >= 5 and t.isdigit())

scrub = set()
for sku, *_ in rows:
    for tok in re.split(r'[,+&]| {2,}', unesc(sku)):
        tok = tok.strip()
        if tok and codelike(tok):
            scrub.add(tok)

FAM_CODE = {'Sheeter': 'SHT', 'Rollstand': 'RST', 'Brakes': 'BRK', 'Hydraulic': 'HYD',
            'Core Splitter': 'VCS', 'Edge Guide & Tension': 'EGT', 'Decurler': 'DCL', 'Other': 'GEN'}
def famof(cc): return CATEGORIES.get(cc, {}).get('family', 'Other')

PRICE_NOISE = [
    # Money, costs, and internal pricing/discount notes must never survive
    # into the public catalog (DATA_BOUNDARIES.md). Applied after code scrub.
    re.compile(r'\$\s?\d[\d.,]*'),
    re.compile(r'\b\d+\.\d{2}\s*/\s*(?:ft|foot|ea|each|pc|set)\b', re.I),
    re.compile(r'\b(?:tgw|gs|oem|vendor|mfg)?\s*cost\b[^,;)]*', re.I),
    re.compile(r'\bwas\s+part\s*#?\S*', re.I),
    re.compile(r'\b\w*#\s*\d{5,}\S*'),
    re.compile(r'\b\d{1,2}%\s*discount\b[^,;)]*', re.I),
    re.compile(r'\bwholesale\b[^,;)]*', re.I),
]

def clean(desc):
    s = unesc(desc).replace('\\n', ' ').strip()
    s = re.sub(r'\((?:[A-Za-z]{0,12}#\s*[^)]+)\)', '', s)
    s = re.sub(r'\b(?:Standard|Std|Gsa)#\s*[A-Za-z0-9./-]+', '', s)
    s = re.sub(r'\bprice\s+per\s+(foot|ft)\b', 'sold per foot', s, flags=re.I)
    s = re.sub(r'\b(?:unit\s+)?price\s+per\s+set\b', 'sold per set', s, flags=re.I)
    for pat in PRICE_NOISE:
        s = pat.sub('', s)
    for tok in scrub:
        if tok in s:
            s = s.replace(tok, '').strip()
    s = re.sub(r'\s{2,}', ' ', s).strip(' ,;-@()')
    if len(s) > 90:
        s = s[:87].rstrip(' ,;-') + '…'
    return s or 'Machine component — details on request'

def band(q):
    q = int(q)
    return 'In Stock' if q >= 3 else ('Limited Stock' if q >= 1 else 'Quote Required')

rows_sorted = sorted(rows, key=lambda r: (famof(r[2]), r[2], unesc(r[0]).upper()))
parts, xw, counters = [], [], {}
for sku, desc, cc, price, qty in rows_sorted:
    fam = famof(cc)
    code = FAM_CODE[fam]
    counters[code] = counters.get(code, 0) + 1
    web = f'JME-{code}-{counters[code]:04d}'
    parts.append({'sku': web, 'name': clean(desc), 'cat': fam,
                  'statusBand': band(qty), 'action': 'request-quote'})
    xw.append([web, unesc(sku), unesc(desc), CATEGORIES.get(cc, {}).get('name', ''), fam, price, qty])

blob = json.dumps(parts)
leaks = [t for t in scrub if t in blob]
assert not leaks, f'real part numbers leaked into public data: {leaks[:5]}'
assert '$' not in blob

fams = sorted(set(p['cat'] for p in parts))
with open(OUT_TS, 'w') as f:
    f.write('/**\n * JME public parts catalog — GENERATED from the private JME Parts Master.\n'
            ' * PUBLIC-SAFE: JME web reference numbers only (never vendor/OEM part numbers),\n'
            ' * cleaned descriptions, availability bands only. No prices, no exact quantities,\n'
            ' * no vendor data. The private crosswalk (web ref -> real part number, price,\n'
            ' * stock) lives OUTSIDE this repository. Do not hand-edit; regenerate instead\n'
            ' * via scripts/generate-public-catalog.py.\n */\n'
            'import type { Part } from "./types";\n\n')
    f.write('export const PART_FAMILIES: string[] = ' + json.dumps(fams) + ';\n\n')
    f.write('export const PARTS_PUBLIC: Part[] = [\n')
    for p in parts:
        f.write('  ' + json.dumps(p) + ' as Part,\n')
    f.write('];\n')

with open(OUT_XW, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Web Ref (public)', 'Real Part # (PRIVATE)', 'Original Description',
                'QB Category', 'Family', 'Sell Price', 'Qty On Hand'])
    w.writerows(xw)

print(f'{len(parts)} parts | families: {fams} | bands: {Counter(p["statusBand"] for p in parts)}')
