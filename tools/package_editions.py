"""Package authorized cover files and EPUB 3 downloads for the local reader."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile
import gzip
import json
import re
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'editions.js'
COVERS = ROOT / 'covers'
DOWNLOADS = ROOT / 'downloads'
CREDITS = json.loads((ROOT/'tools/cover-credits.json').read_text())
XHTML = 'http://www.w3.org/1999/xhtml'
EPUB_NS = 'http://www.idpf.org/2007/ops'
CSS = 'body{margin:5%;line-height:1.5;font-family:serif} h1,h2{line-height:1.2;break-after:avoid} img{display:block;max-width:100%;height:auto;margin:auto} nav ol{padding-left:1.5em}'
XML_HEADER = '<?xml version="1.0" encoding="utf-8"?>'

def esc(s):
    return escape(re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', str(s)), {'"':'&quot;', "'":'&apos;'})

def get_cover(book):
    ident = book['id']
    if ident not in CREDITS or book['sourceName'] != 'Standard Ebooks':
        return None
    path = COVERS / f'{ident}.jpg'
    if not path.is_file():
        url = book['source'] + '/downloads/cover.jpg'
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        im = Image.open(BytesIO(r.content)).convert('RGB')
        if not 0.55 <= im.width/im.height <= 0.85:
            raise ValueError('Invalid portrait cover dimensions')
        im.thumbnail((540,810),Image.Resampling.LANCZOS)
        im.save(path, quality=85, optimize=True)
    return path

def xhtml(title, body):
    return f'{XML_HEADER}<html xmlns="{XHTML}" xmlns:epub="{EPUB_NS}" xml:lang="en" lang="en"><head><title>{esc(title)}</title><link rel="stylesheet" type="text/css" href="book.css"/></head><body>{body}</body></html>'

def package(book):
    ident = book['id']; title = book['title']; author = book['author']; src = book['source']
    try:
        cover = get_cover(book)
    except (requests.RequestException, OSError, ValueError) as ex:
        print(f'No cover for {ident}: {ex}', flush=True)
        cover = None
    if cover:
        book['cover'] = f'covers/{cover.name}'
        book['coverCredit'] = f'Standard Ebooks cover. Artwork: {CREDITS[ident]}'
    blocks = json.loads(gzip.decompress((ROOT/'books'/f'{ident}.json.gz').read_bytes()))['blocks']
    # Split large XHTML documents into e-reader-friendly sections without changing text.
    groups = [[]]; size = 0
    for kind, block in blocks:
        if groups[-1] and (size > 44000 or (kind == 'heading' and size > 9000)):
            groups.append([]); size = 0
        groups[-1].append((kind,block)); size += len(block)
    credit = f'<p>Source: <a href="{esc(src)}">{esc(book["sourceName"])}</a>.</p>'
    if book.get('translator'):
        credit += f'<p>Translated by {esc(book["translator"])}.</p>'
    if cover:
        credit += f'<p>{esc(book["coverCredit"])}</p>'
    if book.get('license'):
        credit += f'<p>License: <a href="{esc(book["licenseUrl"])}">{esc(book["license"])}</a>. {esc(book["rightsNote"])}</p>'
    credit += '<p>Castle Library text edition. Original decorative layout and internal illustrations may be omitted.</p>'
    manifest = '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="book.css" media-type="text/css"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>'
    spine = '<itemref idref="title"/>'
    nav = '<li><a href="title.xhtml">Title and edition information</a></li>'
    if cover:
        manifest += '<item id="cover-art" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>'
        spine = '<itemref idref="cover"/>' + spine
    target = DOWNLOADS / f'{ident}.epub'
    with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=7) as z:
        z.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
        z.writestr('META-INF/container.xml', f'{XML_HEADER}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        z.writestr('EPUB/book.css', CSS)
        z.writestr('EPUB/title.xhtml', xhtml(title,f'<h1>{esc(title)}</h1><p>{esc(author)}</p>{credit}'))
        if cover:
            z.write(cover,'EPUB/cover.jpg')
            z.writestr('EPUB/cover.xhtml', xhtml(title,f'<section epub:type="cover"><img src="cover.jpg" alt="{esc(title)}"/></section>'))
        for i, part in enumerate(groups,1):
            name = f'section-{i}.xhtml'; key = f'text-{i}'
            label = part[0][1].split('\n')[0] if part[0][0] == 'heading' else f'Section {i}'
            markup = ''.join(f'<{tag}>' + esc(text).replace('\n','<br/>') + f'</{tag}>' for kind,text in part for tag in ['h2' if kind == 'heading' else 'p'])
            z.writestr(f'EPUB/{name}',xhtml(label,markup))
            manifest += f'<item id="{key}" href="{name}" media-type="application/xhtml+xml"/>'
            spine += f'<itemref idref="{key}"/>'
            nav += f'<li><a href="{name}">{esc(label)}</a></li>'
        z.writestr('EPUB/nav.xhtml', xhtml('Contents',f'<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>{nav}</ol></nav>'))
        rights = f'<dc:rights>{esc(book["license"] + " " + book["licenseUrl"])}</dc:rights>' if book.get('license') else ''
        z.writestr('EPUB/package.opf',f'{XML_HEADER}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:castle-library:{esc(ident)}</dc:identifier><dc:title>{esc(title)}</dc:title><dc:creator>{esc(author)}</dc:creator><dc:language>en</dc:language><dc:source>{esc(src)}</dc:source>{rights}<meta property="dcterms:modified">2026-11-19T00:00:00Z</meta></metadata><manifest>{manifest}</manifest><spine>{spine}</spine></package>')
    book['download'] = f'downloads/{target.name}'
    print(ident, 'EPUB', '+ official cover' if cover else '', flush=True)
    return book

if __name__ == '__main__':
    COVERS.mkdir(exist_ok=True)
    DOWNLOADS.mkdir(exist_ok=True)
    raw = SOURCE.read_text(encoding='utf-8').split('const LECTERN_EDITIONS = ',1)[1].strip().removesuffix(';')
    with ThreadPoolExecutor(max_workers=10) as pool:
        books = list(pool.map(package,json.loads(raw)))
    SOURCE.write_text('/* Built by tools/import_editions.py and tools/package_editions.py. */\nconst LECTERN_EDITIONS = ' + json.dumps(books,ensure_ascii=False,indent=2) + ';\n', encoding='utf-8')
    print(f'{len(books)} EPUB editions, {sum(bool(b.get("cover")) for b in books)} official covers.')
