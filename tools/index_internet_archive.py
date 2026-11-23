#!/usr/bin/env python3
"""Build data/internet-archive-index.json.gz from Internet Archive search metadata.

Rules: mediatype texts; license URL is a public-domain declaration; date on or before 1929-12-31
(U.S. public domain by publication year); English; not a copyright registry or periodical;
not a Project Gutenberg-derived item (already indexed). Text is fetched on demand from archive.org.
"""
import gzip, json, re, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/internet-archive-index.json.gz'
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
UA = 'CastleLibrary/1.0 (catalog indexer; contact the site operator)'
BASE = 8000000
QUERY = ('mediatype:texts AND licenseurl:(*publicdomain*) AND date:[1000-01-01 TO 1929-12-31] '
         'AND language:eng AND NOT collection:(gutenberg) AND NOT title:(copyright*)')

def first(v):
    if isinstance(v, list): return v[0] if v else ''
    return v or ''

def main():
    rows, seen, page = [], set(), 0
    while len(rows) < LIMIT:
        params = [('q', QUERY), ('rows', '1000'), ('page', str(page + 1)), ('output', 'json'), ('sort[]', 'downloads desc')]
        params += [('fl[]', f) for f in ['identifier', 'title', 'creator', 'date', 'downloads', 'subject']]
        req = urllib.request.Request('https://archive.org/advancedsearch.php?' + urllib.parse.urlencode(params), headers={'User-Agent': UA})
        docs = json.load(urllib.request.urlopen(req, timeout=90))['response']['docs']
        if not docs: break
        page += 1
        for d in docs:
            title = re.sub(r'\s+', ' ', str(first(d.get('title')))).strip()
            creator = re.sub(r'\s+', ' ', str(first(d.get('creator')) or 'Author not listed')).strip()
            key = (title.casefold(), creator.casefold())
            if not title or key in seen: continue
            seen.add(key)
            subjects = [s for s in (d.get('subject') or []) if isinstance(s, str)][:6] if isinstance(d.get('subject'), list) else []
            rows.append([BASE + len(rows) + 1, title[:200], creator[:200], ['en'], '; '.join(subjects), [], str(first(d.get('date')))[:4], 'Text', 3,
                         int(float(d.get('downloads') or 0)), 'Public domain by publication date (on or before 1929) under a public-domain license declared on the item.',
                         d['identifier'], f"https://archive.org/details/{d['identifier']}"])
            if len(rows) >= LIMIT: break
    with gzip.open(OUT, 'wt', encoding='utf-8') as f:
        for row in rows: f.write(json.dumps(row, ensure_ascii=False) + '\n')
    print(f'wrote {len(rows)} Internet Archive rows to {OUT}', flush=True)

if __name__ == '__main__': sys.exit(main())
