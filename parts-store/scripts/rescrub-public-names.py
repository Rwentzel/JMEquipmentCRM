#!/usr/bin/env python3
"""
Apply the public-name scrub to the committed src/data/partsCatalog.ts in
place. The generator applies the same scrub when it is rerun on the private
export; this keeps the committed catalog honest in between.

  python3 scripts/rescrub-public-names.py          # rewrite
  python3 scripts/rescrub-public-names.py --check  # exit 1 if anything would change
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from public_name_scrub import scrub_codes

TS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'partsCatalog.ts')
ROW = re.compile(r'("name": )("(?:[^"\\]|\\.)*")')
src = open(TS, encoding='utf-8').read()
changed = []

def fix(m):
    raw = json.loads(m.group(2))
    out = scrub_codes(raw)
    if out != raw:
        changed.append((raw, out))
    return m.group(1) + json.dumps(out)

new = ROW.sub(fix, src)
if '--check' in sys.argv:
    for a, b in changed:
        print(f"  {a!r} -> {b!r}")
    print(f"{len(changed)} name(s) would change")
    sys.exit(1 if changed else 0)
open(TS, 'w', encoding='utf-8').write(new)
for a, b in changed:
    print(f"  {a!r} -> {b!r}")
print(f"rewrote {len(changed)} name(s) in {os.path.relpath(TS)}")
