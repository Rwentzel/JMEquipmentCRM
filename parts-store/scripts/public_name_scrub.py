"""
Public part-name scrub shared by the catalog generator and the in-place
rescrub of the committed catalog.

DATA_BOUNDARIES.md: vendor part numbers and OEM cross-references are private
(the web-reference scheme exists to keep real numbers off the public
catalog), and internal reorder notes never ship. A description is public;
a code inside it is not. This strips code tokens and only the debris each
removal leaves behind — a name with no code in it comes back unchanged.
Kept: dimensions (70x1020x1t, 35X72X23), thread specs (M10x35x80B), short
model designations (TC1600E, STD1400), and plain words.
"""
import re

_DIM = re.compile(r'^[A-Za-z]?\d+(?:[.,]\d+)?(?:[xX×]\d+(?:[.,]\d+)?)+[A-Za-z]{0,2}$')
_NUM_UNIT = re.compile(r'^\d+(?:[.,]\d+)?(?:mm|MM|cm|in|ft|W|L|T|t|A|V|HP|hp|kg|lb|pcs|pc)$')
_TOKEN = re.compile(r'[A-Za-z0-9]+')
_MARK = '\x00'


def is_code_token(tok: str) -> bool:
    """A vendor / OEM style code: 8+ alphanumerics with at least one letter
    and four digits, not a dimension, thread spec or number-with-unit."""
    if len(tok) < 8:
        return False
    if sum(ch.isalpha() for ch in tok) < 1 or sum(ch.isdigit() for ch in tok) < 4:
        return False
    return not (_DIM.match(tok) or _NUM_UNIT.match(tok))


# A label that only introduces the code, and a purchase multiple that only follows it.
_LABEL_BEFORE = re.compile(r'(?:\b(?:type|includes?|code|model|p/?n|part\s*(?:no\.?|#)?|old|no\.?)\s*:?\s*)?' + _MARK, re.I)
_MULTIPLE_AFTER = re.compile(_MARK + r'(?:\s*(?:qty\.?\s*\d+|[xX]\s*1|each|ea\.?)\b)?', re.I)
_TRAILING_PREP = re.compile(r'\s+(?:for|with|of|to|and|by|from|at|on)\s*$', re.I)


def scrub_codes(name: str) -> str:
    removed: list[str] = []

    def mark(m):
        if is_code_token(m.group(0)):
            removed.append(m.group(0))
            return _MARK
        return m.group(0)

    marked = _TOKEN.sub(mark, name)
    if not removed:
        return name
    # A truncated repeat of a removed code ("… DCT2A04222 + DCT2A") goes too.
    marked = _TOKEN.sub(
        lambda m: _MARK if len(m.group(0)) >= 4 and any(ch.isdigit() for ch in m.group(0))
        and any(c.startswith(m.group(0)) and c != m.group(0) for c in removed) else m.group(0),
        marked,
    )
    s = _LABEL_BEFORE.sub(_MARK, marked)
    s = _MULTIPLE_AFTER.sub(_MARK, s)
    s = re.sub(r'\s*\+\s*' + _MARK, ' ' + _MARK, s)          # "+ CODE"
    s = re.sub(_MARK + r'\s*\+\s*', _MARK + ' ', s)          # "CODE + "

    # A parenthesised group that held the code: drop the group when nothing
    # descriptive is left in it, otherwise just the code.
    def group(m):
        inner = m.group(1).replace(_MARK, ' ')
        rest = re.sub(r'[\s\-/+,.]', '', inner)
        return '' if not rest or re.search(r'[-/+]\s*$', inner.strip()) else '(' + inner.strip() + ')'

    s = re.sub(r'\(([^()]*' + _MARK + r'[^()]*)\)', group, s)
    ended_with_code = bool(re.search(_MARK + r'[\s.\-–—+,;:]*$', s))
    s = s.replace(_MARK, ' ')
    s = re.sub(r'\s+([,;.)])', r'\1', s)
    s = re.sub(r'\(\s+', '(', s)
    s = re.sub(r'\s{2,}', ' ', s).strip()
    if ended_with_code:
        s = re.sub(r'[\s–—\-+,;:.]+$', '', s)
        prev = None
        while prev != s:
            prev, s = s, _TRAILING_PREP.sub('', s)
    s = re.sub(r'\s{2,}', ' ', s).strip(' ,;-+@')
    s = re.sub(r'^\(([^()]*)\)$', r'\1', s).strip()      # a name that is only what the parens held
    return s if len(s) >= 4 else 'Machine component — details on request'
