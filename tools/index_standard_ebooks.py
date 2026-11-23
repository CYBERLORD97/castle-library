#!/usr/bin/env python3
"""Build data/standard-ebooks-index.json.gz from Standard Ebooks' public book pages.

Downloads are not fetched here. Standard Ebooks' robots.txt disallows /ebooks/*/downloads/*
and /ebooks/*/text*, so this script only reads public catalog pages and records the official
GitHub source repository for each title. Castle Library builds an EPUB from that source on demand.
"""
import gzip, html, json, re, sys, time, urllib.request, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/standard-ebooks-index.json.gz'
UA = 'CastleLibrary/1.0 (catalog indexer for Standard Ebooks; contact the site operator)'
BASE = 9000000  # Standard Ebooks ids live in this namespace; Gutenberg ids are below 90 million.

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r: return r.read().decode('utf-8', 'replace')

def book_urls():
    sitemap = get('https://standardebooks.org/sitemap')
    urls = re.findall(r'<loc>(https://standardebooks\.org/ebooks/[^<]+)</loc>', sitemap)
    return sorted({u.rstrip('/') for u in urls if u.count('/') == 5})

def parse(url):
    time.sleep(0.4)
    page = get(url)
    head = re.search(r'<title>(.*?)</title>', page, re.S)
    m = re.match(r'(.*), by (.*?) - Free ebook download', html.unescape(head.group(1)) if head else '')
    if not m: return None
    repo = re.search(r'github\.com/standardebooks/([a-z0-9_-]+)/', page)
    lang = re.search(r'property="schema:inLanguage" content="([^"]+)"', page)
    subjects = [html.unescape(s).strip() for s in re.findall(r'href="/subjects/[^"]+">([^<]+)<', page)]
    return {'url': url, 'title': m.group(1).strip(), 'author': m.group(2).strip(), 'repo': repo.group(1) if repo else '',
            'lang': lang.group(1).split('-')[0] if lang else 'en', 'subjects': sorted(set(subjects))}

def main():
    urls = book_urls()
    print(f'{len(urls)} candidate book pages', flush=True)
    with ThreadPoolExecutor(4) as pool:
        records = [r for r in pool.map(parse, urls) if r and r['repo']]
    records.sort(key=lambda r: (r['title'].casefold(), r['author'].casefold()))
    rows = []
    for n, r in enumerate(records, 1):
        cats = [s for s in r['subjects'] if s]
        rows.append([BASE + n, r['title'], r['author'], [r['lang']], '; '.join(cats), cats, '', 'Text', 3, 0,
                     'Standard Ebooks: text and artwork dedicated to the public domain (CC0). Check local law in other countries.',
                     r['repo'], r['url']])
    with gzip.open(OUT, 'wt', encoding='utf-8') as f:
        for row in rows: f.write(json.dumps(row, ensure_ascii=False) + '\n')
    print(f'wrote {len(rows)} Standard Ebooks rows to {OUT}', flush=True)

if __name__ == '__main__': sys.exit(main())
