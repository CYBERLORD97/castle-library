"""Join official bulk catalog data to the RDF edition rights and format metadata."""
import csv, gzip, json, re, sys, tarfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DC = '{http://purl.org/dc/terms/}'
PG = '{http://www.gutenberg.org/2009/pgterms/}'
RDF = '{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
CUTOFF = 1955  # Conservative screening for named creators and translators in 2026.

def rights_index(filename):
    result = {}
    with tarfile.open(filename,'r|bz2') as tar:
        for member in tar:
            if not member.name.endswith('.rdf') or not member.isfile(): continue
            try:
                root = ET.parse(tar.extractfile(member)).getroot().find(PG+'ebook')
                book_id = int(root.get(RDF+'about').rsplit('/',1)[-1])
                rights = (root.findtext(DC+'rights') or '').strip().lower()
                # A public-domain declaration for the US does not establish rights in every country.
                recent = False
                for agent in root.iter(PG+'agent'):
                    died = agent.findtext(PG+'deathdate') or ''
                    born = agent.findtext(PG+'birthdate') or ''
                    yr = re.search(r'\b[12]\d{3}\b',died)
                    birth = re.search(r'\b[12]\d{3}\b',born)
                    if (yr and int(yr[0]) > CUTOFF) or (not yr and birth and int(birth[0]) > 1855):
                        recent = True
                        break
                flags = 0
                if rights == 'public domain in the usa.' and not recent:
                    for file in root.findall(DC+'hasFormat/'+PG+'file'):
                        href = (file.get(RDF+'about') or '').lower()
                        if href.endswith('.txt.utf-8') or href.endswith(f'/pg{book_id}.txt'): flags |= 1
                        if href.endswith('.epub.noimages') or href.endswith(f'/pg{book_id}.epub'): flags |= 2
                        if href.endswith('.epub.images') or href.endswith(f'/pg{book_id}-images.epub'): flags |= 4
                result[book_id] = (flags, int(root.findtext(PG+'downloads') or 0), rights)
            except (ET.ParseError, ValueError, AttributeError): continue
    return result

def main(source):
    rights = rights_index(source)
    print(f'{len(rights)} RDF edition records analyzed.', flush=True)
    data = ROOT/'data'
    name = data/'gutenberg-index.json.gz'
    tmp = data/'gutenberg-index.tmp'
    seen = set(); stats = [0,0]
    with gzip.open(data/'gutenberg-catalog.csv.gz','rt',encoding='utf-8-sig',newline='') as catalog, gzip.open(tmp,'wt',encoding='utf-8',compresslevel=7) as output:
        for row in csv.DictReader(catalog):
            try: ident = int(row['Text#'])
            except (ValueError,TypeError): continue
            if ident in seen: continue
            seen.add(ident)
            flags, popularity, status = rights.get(ident,(0,0,''))
            kind = row['Type'].strip()
            if kind.lower() != 'text': flags = 0
            categories = [c.removeprefix('Category: ').strip() for c in row['Bookshelves'].split('; ') if c.startswith('Category: ')]
            record = [ident,' '.join(row['Title'].split()),' '.join(row['Authors'].split()),[x.strip() for x in row['Language'].split(';') if x.strip()],row['Subjects'],categories,row['Issued'],kind,flags,popularity,status]
            output.write(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
            stats[0] += bool(flags & 1); stats[1] += bool(flags & 6)
    tmp.replace(name)
    print(f'{len(seen)} catalog records; {stats[0]} reader candidates, {stats[1]} EPUB candidates.', flush=True)

if __name__ == '__main__': main(sys.argv[1])
