"""Castle Library website and same-origin Project Gutenberg collection."""
import argparse
from collections import Counter
from functools import lru_cache
import gzip
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import posixpath
import re
from threading import BoundedSemaphore, Lock
import os
import shutil
import subprocess
import time
import unicodedata
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import zipfile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
MIRROR = 'https://gutenberg.pglaf.org'
CHUNK = 48
UPSTREAM = BoundedSemaphore(4)
LOCKS = [Lock() for _ in range(32)]
INDEX = None
SE_BASE = 9000000
IA_BASE = 8000000
IA_LIMIT_BYTES = 15 * 1024 * 1024
SE_LIMIT_BYTES = 2 * 1024**3
SE_BUILD = BoundedSemaphore(2)
SE_CACHE = Path(os.environ.get('CASTLE_SE_CACHE', Path.home()/'.cache/castle-library/standard-ebooks'))
SE_BIN = os.environ.get('CASTLE_SE_BIN') or shutil.which('se')
INDEX_LOCK = Lock()
SOURCE_ERROR = 'This edition is temporarily unavailable from the Project Gutenberg mirror.'
class EditionUnavailable(Exception): pass

def key(s):
    return ''.join(c for c in unicodedata.normalize('NFKD',s).casefold() if not unicodedata.combining(c)).replace('’',"'")

def records():
    global INDEX
    if INDEX is not None: return INDEX
    with INDEX_LOCK:
        if INDEX is not None: return INDEX
        compressed = ROOT/'data/gutenberg-index.json.gz'
        with gzip.open(compressed,'rt',encoding='utf-8') as f:
            rows = [json.loads(line) for line in f]
        for extra in ('data/standard-ebooks-index.json.gz','data/internet-archive-index.json.gz'):
            extra_path=ROOT/extra
            if extra_path.exists():
                with gzip.open(extra_path,'rt',encoding='utf-8') as f:
                    rows += [json.loads(line) for line in f]
        rows.sort(key=lambda r: (-r[9],r[0]))
        searchable = [(r, key(f'{r[1]} {r[2]} {r[4]} {" ".join(r[5])}')) for r in rows]
        langs = Counter(l for r in rows for l in r[3]); cats = Counter(c for r in rows for c in r[5]); kinds = Counter(r[7] for r in rows)
        meta = {'total':len(rows),'reading':sum(bool(r[8]&7) for r in rows),'epub':sum(bool(r[8]&6) for r in rows), 'languages':sorted(langs.items(),key=lambda p:(-p[1],p[0])), 'subjects':sorted(cats.items()), 'types':sorted(kinds.items())}
        INDEX = searchable, {r[0]:r for r in rows}, meta
        return INDEX

def item(r):
    i,t,a,l,s,c,issued,kind,flags,_,rights = r[:11]
    source = {'name':'Castle Library','url':''}
    return {'id':i,'title':t,'author':a,'languages':l,'subjects':c,'kind':kind,'read':bool(flags&7),'download':bool(flags&6),'rights':rights,'source':source}

TOPICS = {
    'fiction': ('Novels','Short Stories','Classics of Literature','Historical Novels','Adventure','Romance','Crime, Thrillers and Mystery','Science-Fiction & Fantasy'),
    'philosophy': ('Philosophy & Ethics',), 'investing': ('Economics','Business/Management'),
    'engineering': ('Engineering & Technology','Mathematics','Nature/Gardening/Animals','Science - Biology','Science - Chemistry/Biochemistry','Science - Earth/Agricultural/Farming','Science - Physics'),
    'history': tuple(), 'essays': ('Essays, Letters & Speeches',), 'poetry': ('Poetry',), 'drama': ('Plays/Films/Dramas',),
    'adventure': ('Adventure',), 'children': ('Children & Young Adult Reading',),
    'memoir': ('Biographies','Journals'), 'mystery': ('Crime, Thrillers and Mystery',), 'romance': ('Romance',),
    'scifi': ('Science-Fiction & Fantasy',), 'gothic': tuple(),
}

def matches_topic(topic, row, content):
    if not topic or topic not in TOPICS: return True
    if topic == 'history': return any(c.startswith('History - ') or c == 'Biographies' for c in row[5])
    if topic == 'gothic': return any(w in content for w in ('gothic','horror','ghost stories'))
    return any(c in TOPICS[topic] for c in row[5])

@lru_cache(maxsize=96)
def search(q, lang, subject, kind, access, sort, topic):
    results = []
    tokens = key(q).split()
    for r, content in records()[0]:
        if lang and lang not in r[3] or subject and subject not in r[5] or kind and kind != r[7] or not matches_topic(topic,r,content): continue
        flags=r[8]
        if access == 'read' and not flags&7 or access == 'epub' and not flags&6 or access == 'record' and flags: continue
        if tokens and str(r[0]) != q.strip().lstrip('#') and not all(x in content for x in tokens): continue
        results.append(r)
    if sort == 'title': results.sort(key=lambda r: (key(r[1]),r[0]))
    elif sort == 'latest': results.sort(key=lambda r: (r[6],r[0]),reverse=True)
    elif tokens:
        needle=key(q)
        results.sort(key=lambda r: (0 if key(r[1])==needle else 1 if needle in key(r[1]) else 2 if needle in key(r[2]) else 3, -r[9],r[0]))
    return results

def supply(ident,suffix,maximum):
    url=f'{MIRROR}/cache/epub/{ident}/pg{ident}{suffix}'
    if not UPSTREAM.acquire(timeout=2): raise EditionUnavailable('The archive is busy. Please try again in a moment.')
    try:
        with urlopen(Request(url,headers={'User-Agent':'CastleLibrary/1.0 (on-demand Gutenberg mirror reader)'}),timeout=9) as response:
            if urlsplit(response.geturl()).hostname != 'gutenberg.pglaf.org': raise EditionUnavailable(SOURCE_ERROR)
            if int(response.headers.get('Content-Length','0')) > maximum: raise EditionUnavailable('This edition exceeds the online delivery size limit.')
            buf=response.read(maximum+1)
            if len(buf)>maximum or not buf: raise EditionUnavailable('This edition is too large or empty.')
            return buf
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as e:
        raise EditionUnavailable(SOURCE_ERROR) from e
    finally: UPSTREAM.release()

def paginate(content, verse=False):
    content=content.replace('\r\n','\n').replace('\r','\n')
    start=re.search(r'^\*{3}\s*START OF[^\n]*PROJECT GUTENBERG[^\n]*\*{3}\s*$',content,re.I|re.M)
    if not start: raise EditionUnavailable('The plain text edition could not be formatted.')
    end=re.search(r'^\*{3}\s*END OF[^\n]*PROJECT GUTENBERG[^\n]*\*{3}\s*$',content[start.end():],re.I|re.M)
    if not end: raise EditionUnavailable('The plain text edition could not be formatted.')
    text=content[start.end():start.end()+end.start()].strip()
    def blocks():
        for paragraph in re.split(r'\n[^\S\n]*\n+',text):
            original=paragraph.strip()
            if not original: continue
            heading=len(original)<100 and (original.isupper() or bool(re.match(r'^(chapter|book|part|act)\s+\w',original,re.I)))
            yield 'heading' if heading else 'text', original if verse else ' '.join(original.split())
    return paginate_blocks(blocks())


SOURCE_CREDIT = re.compile(r'project gutenberg|standard ebooks|internet archive|archive\.org|digitized by', re.I)
FRONT_MATTER = re.compile(r'(^|/)(imprint|colophon|uncopyright)[^/]*$', re.I)

def paginate_blocks(blocks):
    pages=[]; page=[]; length=0
    for kind,text in blocks:
        if SOURCE_CREDIT.search(text): continue
        heading=kind=='heading'
        for chunk in re.findall(r'.{1,690}(?=\s|$)\s*|.{1,690}',text,re.S):
            weight=len(chunk)+ (90 if heading else 28) + 20*chunk.count('\n')
            if page and (length+weight>850 or heading and length>450) and page[-1][0] != 'heading':
                pages.append(page); page=[]; length=0
            page.append(['heading' if heading else 'text',chunk.strip()]); length+=weight
    if page: pages.append(page)
    if not pages: raise EditionUnavailable('This edition contains no readable text.')
    return pages

def internet_archive_text(row):
    identifier=row[11]
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,120}',identifier or ''): raise EditionUnavailable('This item is not valid.')
    meta=json.loads(fetch_bytes(f'https://archive.org/metadata/{identifier}',2*1024*1024))
    names=[f['name'] for f in meta.get('files',[]) if f.get('name','').endswith('_djvu.txt')]
    if not names: raise EditionUnavailable('This item has no readable text in the Internet Archive yet.')
    quoted=quote(names[0],safe='/')
    raw=fetch_bytes(f'https://archive.org/download/{identifier}/{quoted}',IA_LIMIT_BYTES)
    return raw.decode('utf-8-sig',errors='replace')

def ia_blocks(text):
    for paragraph in re.split(r'\n[^\S\n]*\n+',text.replace('\r\n','\n')):
        original=paragraph.strip()
        if not original: continue
        heading=len(original)<100 and original.isupper()
        yield ('heading' if heading else 'text'), ' '.join(original.split())

def fetch_bytes(url,limit):
    if not UPSTREAM.acquire(timeout=2): raise EditionUnavailable('The archive is busy. Please try again in a moment.')
    try:
        with urlopen(Request(url,headers={'User-Agent':'CastleLibrary/1.0 (on-demand reader)'}),timeout=25) as response:
            host=urlsplit(response.geturl()).hostname or ''
            if host not in ('archive.org','ia800000.us.archive.org') and not host.endswith('.archive.org'): raise EditionUnavailable(SOURCE_ERROR)
            if int(response.headers.get('Content-Length','0') or 0) > limit: raise EditionUnavailable('This item exceeds the online size limit.')
            buf=response.read(limit+1)
            if len(buf)>limit or not buf: raise EditionUnavailable('This item is too large or empty.')
            return buf
    except HTTPError as e:
        raise EditionUnavailable('This item has no readable text in the Internet Archive yet.' if e.code==404 else 'The Internet Archive is temporarily unavailable.') from e
    except (URLError,TimeoutError,OSError,ValueError) as e:
        raise EditionUnavailable('The Internet Archive is temporarily unavailable.') from e
    finally: UPSTREAM.release()

@lru_cache(maxsize=12)
def ia_text(ident):
    row=records()[1].get(ident)
    return internet_archive_text(row)

@lru_cache(maxsize=12)
def locked_text_pages(ident):
    row=records()[1].get(ident)
    if IA_BASE <= ident < SE_BASE:
        return paginate_blocks(ia_blocks(ia_text(ident)))
    if ident >= SE_BASE: return epub_pages(ident)
    if row[8]&1:
        try:
            raw=supply(ident,'.txt',8*1024*1024)
            return paginate(raw.decode('utf-8-sig'), any('Poetry' in category for category in row[5]))
        except (EditionUnavailable,UnicodeError):
            if not row[8]&6:
                raise EditionUnavailable('This text is temporarily unavailable in the Castle Library reader.')
    return epub_pages(ident)

def text_pages(ident):
    with LOCKS[ident%len(LOCKS)]: return locked_text_pages(ident)

@lru_cache(maxsize=12)
def epub(ident):
    r=records()[1].get(ident)
    if ident >= SE_BASE: return standard_epub(r)
    if ident >= IA_BASE: return text_epub(r, ia_text(ident))
    candidates=(['.epub'] if r[8]&2 else [])+(['-images.epub'] if r[8]&4 else [])
    for suffix in candidates:
        try:
            content=supply(ident,suffix,18*1024*1024)
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if archive.getinfo('mimetype').file_size != 20 or archive.read('mimetype')!=b'application/epub+zip': raise ValueError('Bad EPUB')
            return content
        except (EditionUnavailable,zipfile.BadZipFile,KeyError,ValueError): continue
    raise EditionUnavailable('An EPUB for this edition is unavailable at the mirror or exceeds the download size limit.')

def standard_epub(row):
    """Build a Standard Ebooks EPUB from its official GitHub source with the official `se` tool."""
    repo=row[11]
    if not re.fullmatch(r'[a-z0-9_-]+',repo or ''): raise EditionUnavailable('This Standard Ebooks source is not valid.')
    if not SE_BIN: raise EditionUnavailable('Standard Ebooks builds are not configured on this server yet.')
    SE_CACHE.mkdir(parents=True,exist_ok=True)
    built=SE_CACHE/f'{repo}.epub'
    if built.exists():
        built.touch()
        return built.read_bytes()
    with SE_BUILD:
        if built.exists(): return built.read_bytes()
        work=SE_CACHE/f'.work-{repo}-{os.getpid()}-{time.time_ns()}'
        try:
            subprocess.run(['git','clone','--depth','1','--quiet',f'https://github.com/standardebooks/{repo}.git',str(work/'src')],
                timeout=120,check=True,env={**os.environ,'GIT_TERMINAL_PROMPT':'0'},capture_output=True)
            out=work/'out'; out.mkdir()
            subprocess.run([SE_BIN,'build','-o',str(out),str(work/'src')],timeout=300,check=True,capture_output=True)
            produced=out/f'{repo}.epub'
            if not produced.exists(): raise EditionUnavailable('The Standard Ebooks build did not produce an EPUB.')
            with zipfile.ZipFile(produced) as archive:
                if archive.getinfo('mimetype').file_size != 20 or archive.read('mimetype')!=b'application/epub+zip': raise EditionUnavailable('The Standard Ebooks build produced an invalid EPUB.')
            os.replace(produced,built)
        except (subprocess.SubprocessError,OSError,zipfile.BadZipFile,KeyError) as error:
            raise EditionUnavailable('This Standard Ebooks title could not be built right now. Please try again later.') from error
        finally:
            shutil.rmtree(work,ignore_errors=True)
        evict_standard_cache()
    return built.read_bytes()

def evict_standard_cache():
    files=sorted(SE_CACHE.glob('*.epub'),key=lambda p:p.stat().st_mtime)
    total=sum(p.stat().st_size for p in files)
    while files and total>SE_LIMIT_BYTES:
        old=files.pop(0); total-=old.stat().st_size; old.unlink(missing_ok=True)

def text_epub(row, text):
    """Package a plain-text edition as a valid EPUB 3 file for download."""
    from xml.sax.saxutils import escape
    paragraphs=[t for kind,t in ia_blocks(text)]
    chunks=[paragraphs[i:i+300] for i in range(0,len(paragraphs),300)] or [[]]
    title=escape(row[1][:200]); author=escape(row[2][:200])
    ident=row[0]
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'),'application/epub+zip',compress_type=zipfile.ZIP_STORED)
        z.writestr('META-INF/container.xml','<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        manifest=['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>']
        spine=[]
        for n,chunk in enumerate(chunks,1):
            body=''.join(f'<p>{escape(t)}</p>' for t in chunk)
            z.writestr(f'OEBPS/part{n}.xhtml',f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><head><title>{title}</title></head><body>{body}</body></html>')
            manifest.append(f'<item id="p{n}" href="part{n}.xhtml" media-type="application/xhtml+xml"/>')
            spine.append(f'<itemref idref="p{n}"/>')
        nav=''.join(f'<li><a href="part{n}.xhtml">Part {n}</a></li>' for n in range(1,len(chunks)+1))
        z.writestr('OEBPS/nav.xhtml',f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>{title}</title></head><body><nav epub:type="toc"><ol>{nav}</ol></nav></body></html>')
        z.writestr('OEBPS/content.opf',f'<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:castle-library:{ident}</dc:identifier><dc:title>{title}</dc:title><dc:creator>{author}</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest>{"".join(manifest)}</manifest><spine>{"".join(spine)}</spine></package>')
    return out.getvalue()

class EPUBText(HTMLParser):
    BLOCKS = {'p','div','section','article','li','dt','dd','blockquote','pre','td','tr','figcaption','h1','h2','h3','h4','h5','h6'}
    OMIT = {'head','script','style','svg','nav','iframe','object','template'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks=[]
        self.parts=[]
        self.omitted=[]
        self.heading=False

    def flush(self):
        text=''.join(self.parts).strip()
        if text:
            self.blocks.append(('heading' if self.heading else 'text',text))
        self.parts=[]

    def handle_starttag(self,tag,attrs):
        if self.omitted or tag in self.OMIT:
            if tag in self.OMIT: self.omitted.append(tag)
            return
        if tag in self.BLOCKS:
            self.flush()
            self.heading=tag in {'h1','h2','h3','h4','h5','h6'}
        if tag=='br': self.parts.append('\n')

    def handle_endtag(self,tag):
        if self.omitted:
            if self.omitted[-1]==tag: self.omitted.pop()
            return
        if tag in self.BLOCKS:
            self.flush()
            self.heading=False

    def handle_data(self,text):
        if not self.omitted: self.parts.append(re.sub(r'\s+',' ',text))


def epub_blocks(payload):
    CONTAINER='{urn:oasis:names:tc:opendocument:xmlns:container}'
    OPF='{http://www.idpf.org/2007/opf}'
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        def bounded(name, limit):
            if z.getinfo(name).file_size > limit: raise ValueError('Oversize EPUB entry')
            return z.read(name)
        container=ET.fromstring(bounded('META-INF/container.xml',100000))
        package_path=container.find('.//'+CONTAINER+'rootfile').get('full-path')
        package=ET.fromstring(bounded(package_path,3*1024*1024))
        manifest={m.get('id'):m for m in package.findall(OPF+'manifest/'+OPF+'item')}
        remaining=24*1024*1024
        for ref in package.findall(OPF+'spine/'+OPF+'itemref')[:2500]:
            resource=manifest.get(ref.get('idref'))
            if resource is None or resource.get('media-type') not in ('application/xhtml+xml','text/html'): continue
            if 'nav' in (resource.get('properties') or '').split(): continue
            if FRONT_MATTER.search(resource.get('href') or ''): continue
            href=urlsplit(resource.get('href') or '')
            if href.scheme or href.netloc or not href.path: continue
            name=posixpath.normpath(posixpath.join(posixpath.dirname(package_path),unquote(href.path)))
            content=bounded(name,remaining)
            remaining-=len(content)
            parser=EPUBText()
            text=content.decode('utf-16') if content.startswith((b'\xff\xfe',b'\xfe\xff')) else content.decode('utf-8-sig',errors='replace')
            parser.feed(text); parser.close(); parser.flush()
            yield from parser.blocks


def epub_pages(ident):
    try:
        return paginate_blocks(epub_blocks(epub(ident)))
    except (zipfile.BadZipFile,ET.ParseError,AttributeError,KeyError,ValueError,OSError) as error:
        raise EditionUnavailable('The EPUB could not be formatted for the Castle Library reader.') from error


class CastleHandler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kw): super().__init__(*args,directory=str(ROOT),**kw)

    def reply(self,status,body,content_type='application/json; charset=utf-8',extra=()):
        if isinstance(body,dict) or isinstance(body,list): body=json.dumps(body,ensure_ascii=True,separators=(',',':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('X-Content-Type-Options','nosniff')
        for k,v in extra: self.send_header(k,v)
        self.end_headers()
        try: self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError): pass

    def send_head(self):
        path=urlsplit(self.path).path
        public_files={'/','/index.html','/app.js','/catalog.js','/editions.js','/styles.css','/aged-parchment.jpg',
                      '/castle-hero.jpg','/dark-shelf.jpg','/marbled-endpaper.jpg','/strahov-room.jpg','/trinity-room.jpg','/wood-shelf.jpg'}
        if path in public_files or re.fullmatch(r'/(covers/[a-z0-9-]+\.jpg|downloads/[a-z0-9-]+\.epub|pages/[a-z0-9-]+/\d+\.json|audio/[a-z0-9-]+\.mp3|brand/[a-z0-9-]+\.png)',path):
            return super().send_head()
        self.send_error(404)
        return None

    def do_GET(self):
        url=urlsplit(self.path)
        path=url.path
        if not path.startswith('/api/'):
            return super().do_GET()
        if not path.startswith('/api/gutenberg'):
            return self.reply(404,{'error':'Not found'})
        try:
            _,bookmap,meta=records()
            if path=='/api/gutenberg/meta': return self.reply(200,meta,extra=[('Cache-Control','public,max-age=600')])
            if path=='/api/gutenberg':
                args=parse_qs(url.query)
                pick=lambda k,n=100:args.get(k,[''])[0][:n].strip()
                try: page=max(1,min(100000,int(pick('page',8) or 1)))
                except ValueError: return self.reply(400,{'error':'Invalid page'})
                hits=search(pick('q',160),pick('lang',20),pick('subject'),pick('type'),pick('access',12),pick('sort',12),pick('topic',20))
                size=12; page=min(page,max(1,(len(hits)+size-1)//size))
                offset, take = (page-1)*size, size
                if 'offset' in args:
                    try:
                        offset = max(0,min(1000000,int(pick('offset',8))))
                        take = max(0,min(size,int(pick('limit',3) or size)))
                    except ValueError: return self.reply(400,{'error':'Invalid catalog range'})
                data={'count':len(hits),'page':page,'size':size,'items':[item(r) for r in hits[offset:offset+take]]}
                return self.reply(200,data)
            match=re.fullmatch(r'/api/gutenberg/(\d{1,8})/(read|epub|pages/(\d{1,6})\.json)',path)
            if not match: return self.reply(404,{'error':'Not found'})
            ident=int(match[1]); action=match[2]; row=bookmap.get(ident)
            if not row: return self.reply(404,{'error':'Edition not in the archive index'})
            flags=row[8]
            if action=='epub':
                if not flags&6: return self.reply(404,{'error':'No eligible EPUB'})
                payload=epub(ident)
                filename=quote(row[1][:100]+'.epub',safe='')
                return self.reply(200,payload,'application/epub+zip',[('Content-Disposition',f'attachment; filename="{ident}.epub"; filename*=UTF-8\'\'{filename}'),('Cache-Control','public,max-age=1800')])
            if not flags&7: return self.reply(404,{'error':'No eligible text edition'})
            pages=text_pages(ident)
            if action=='read': return self.reply(200,{'pageCount':len(pages),'pageChunkSize':CHUNK,'startPages':pages[:2]},extra=[('Cache-Control','public,max-age=1800')])
            index=int(match[3]); chunk=pages[index*CHUNK:(index+1)*CHUNK]
            return self.reply(200,chunk,extra=[('Cache-Control','public,max-age=1800')]) if chunk else self.reply(404,{'error':'Section not found'})
        except FileNotFoundError: return self.reply(503,{'error':'The archive catalog is being prepared.'})
        except EditionUnavailable as ex: return self.reply(502,{'error':str(ex)})

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=3000); args=parser.parse_args()
    print(f'Castle Library listening on {args.port}',flush=True)
    ThreadingHTTPServer(('0.0.0.0',args.port),CastleHandler).serve_forever()
