"""Build plain-text lectern editions from Standard Ebooks and Project Gutenberg transcriptions. Needs requests and beautifulsoup4."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import gzip
import json
import re
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://standardebooks.org/ebooks/'
ROWS = [line.strip().split('|') for line in (ROOT / 'tools/editions.tsv').read_text().splitlines() if line.strip()]

def gutenberg_blocks(slug):
    _, number, name = slug.split(':')
    mirror = f'https://raw.githubusercontent.com/GITenberg/{name}_{number}/master/{number}.txt'
    response = requests.get(mirror, timeout=24)
    response.raise_for_status()
    try:
        text = response.content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = response.content.decode('cp1252')
    text = text.replace('\r\n', '\n')
    start = re.search(r'^\*\*\* START[^\n]*?\*\*\*$', text, re.M)
    end = re.search(r'^(?:End of the Project Gutenberg|\*\*\* END OF)', text, re.M | re.I)
    if not start or not end or start.end() >= end.start():
        raise ValueError('Text boundaries not found')
    blocks = []
    for paragraph in re.split(r'\n\s*\n', text[start.end():end.start()].strip()):
        raw = paragraph.strip()
        if not raw:
            continue
        clean = re.sub(r'\s+', ' ', raw)
        kind = 'heading' if len(clean) < 100 and clean.isupper() else 'text'
        if any(line.startswith('    ') for line in paragraph.splitlines()) and '  ' in paragraph.strip():
            clean = '\n'.join(line.strip() for line in paragraph.splitlines()).strip()
        blocks.append([kind, clean])
    return blocks

DOCTOROW_SOURCE = 'https://craphound.com/littlebrother/download/'
DOCTOROW_LICENSE = 'https://creativecommons.org/licenses/by-nc-sa/3.0/'

def additional_blocks(slug, source):
    if slug.startswith('pga:'):
        r = requests.get(source, timeout=24)
        r.raise_for_status()
        doc = BeautifulSoup(r.content, 'html.parser')
        blocks = []
        for node in doc.find('h1').next_siblings:
            if not getattr(node, 'name', None):
                continue
            text = ' '.join(node.get_text().split())
            if re.match(r'^(?:end of (?:the |this )?project gutenberg|\*{3} ?end|the end$)', text, re.I):
                break
            if node.name in {'h2','h3','p','blockquote'} and text:
                blocks.append(['heading' if node.name in {'h2','h3'} else 'text', text])
        return blocks
    r = requests.get('https://craphound.com/littlebrother/Cory_Doctorow_-_Little_Brother.txt', timeout=24)
    r.raise_for_status()
    text = r.content.decode('utf-8-sig').replace('\r\n','\n')
    blocks = []
    for paragraph in re.split(r'\n[ \t]*\n', text.strip()):
        if paragraph.strip() == '&&&':
            continue
        if text := paragraph.strip():
            blocks.append(['heading' if text.isupper() and len(text) < 75 else 'text', text])
    return blocks

def get_book(row):
    ident, title, author, category, year, slug, description, translator, origin = (row + ['', ''])[:9]
    is_pg = slug.startswith('pg:')
    is_pga = slug.startswith('pga:')
    is_cc = slug.startswith('cc:')
    source = f'https://www.gutenberg.org/ebooks/{slug.split(":")[1]}' if is_pg else f'https://gutenberg.net.au/ebooks02/{slug[4:]}.html' if is_pga else DOCTOROW_SOURCE if is_cc else BASE + slug
    filename = ROOT / 'books' / (ident + '.json.gz')
    if not filename.exists():
        if is_pg:
            blocks = gutenberg_blocks(slug)
        elif is_pga or is_cc:
            blocks = additional_blocks(slug, source)
        else:
            r = requests.get(source + '/text/single-page', timeout=24)
            r.raise_for_status()
            doc = BeautifulSoup(r.content, 'html.parser')
            main = doc.find('main')
            for node in main.select('#titlepage, #imprint, #colophon, #uncopyright, [epub\\:type="toc"], [epub\\:type="backlink"]'):
                node.decompose()
            blocks = []
            for node in main.find_all(['h1','h2','h3','h4','h5','p','li','tr','figcaption','dt','dd']):
                parents = {p.name for p in node.parents if p != main}
                if node.name in ('p', 'li') and 'tr' in parents:
                    continue
                if node.name == 'li' and node.find(['p','li']):
                    continue
                if node.name == 'p':
                    for br in node.find_all('br'):
                        br.replace_with('\n')
                if node.name == 'tr':
                    text = ' · '.join(c.get_text().strip() for c in node.find_all(['th','td'], recursive=False))
                else:
                    text = node.get_text()
                text = '\n'.join(re.sub(r'[^\S\n]+', ' ', line).strip() for line in text.strip().split('\n'))
                text = re.sub(r'\n{2,}', '\n', text).strip()
                if text:
                    kind = 'heading' if re.fullmatch(r'h[1-5]', node.name) else 'text'
                    blocks.append([kind, text])
        if len(blocks) < 20:
            raise ValueError('extracted too little text')
        filename.write_bytes(gzip.compress((json.dumps({'blocks':blocks}, ensure_ascii=False, separators=(',',':'))+'\n').encode('utf-8'), compresslevel=7, mtime=0))
    metadata = {'id':ident, 'title':title, 'author':author, 'cat':category, 'year':year, 'tagline':description, 'access':'lectern', 'source':source, 'sourceName':'Project Gutenberg' if is_pg else 'Project Gutenberg Australia' if is_pga else 'Cory Doctorow' if is_cc else 'Standard Ebooks', 'translator':translator.strip(), 'origin':origin.strip() or 'expanded'}

    if is_cc:
        metadata.update(license='CC BY-NC-SA 3.0', licenseUrl=DOCTOROW_LICENSE, rightsNote='Text from the author’s official download, reformatted for Castle Library. Commercial reuse is not permitted by this license. The publisher’s cover is not included.')
    return metadata

def safe(row):
    try:
        result = get_book(row)
        print('OK', row[0], flush=True)
        return result
    except (requests.RequestException, ValueError, AttributeError) as exc:
        print('FAILED', row[0], exc, flush=True)
        return None

if __name__ == '__main__':
    (ROOT/'books').mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        entries = [b for b in pool.map(safe, ROWS) if b]
    if len(entries) != len(ROWS):
        print(f'{len(ROWS) - len(entries)} manifest entries were not imported; they will not appear as readable.')
    (ROOT / 'editions.js').write_text('/* Generated from tools/editions.tsv. */\nconst LECTERN_EDITIONS = ' + json.dumps(entries, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
