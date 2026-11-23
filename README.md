# The Castle Library

Run `python server.py --port 3000` from the project root. This starts the website and the same-origin Project Gutenberg API. The curated collection can also run on a static host, but the Gutenberg catalog, reader, and downloads require this server with outbound HTTPS access to the Project Gutenberg mirror. Opening `index.html` directly does not run either reader reliably.

## Collection and access

- The browser reader and the one-click EPUB download use local copies of the same 78 authorized text editions. These editions appear first in the unified catalog.
- There are 69 matching Standard Ebooks covers. Unavailable covers are not substituted with unlicensed publisher artwork: those books appear with a Castle binding. The edition pages credit the source text and cover artwork.
- Catalog-only records are still searchable with the **All titles** or **Catalog records only** views. They have no external reading links and no download buttons. OceanofPDF was used for a small earlier bibliographic sample, not as a source of texts or book files.
- *Little Brother* is included under Cory Doctorow’s CC BY-NC-SA 3.0 license, with attribution, an explanation of the format change, and no publisher cover. Keep its noncommercial and share-alike terms in any distribution; remove it before any use incompatible with those terms.

## Project Gutenberg archive

The single Castle Library catalog searches the curated editions and a snapshot of the entire official Project Gutenberg CSV catalog together. The index joins that catalog to the official RDF metadata for rights, file formats, and popularity. It retains non-text items and records that this site does not serve. The archive is not a local copy of all Gutenberg ebook files. When a reader selects a supported text edition, the server fetches it from the official mirror on demand. The lectern opens inside Castle Library immediately, then loads a reading edition from the plain text or from the EPUB’s text as a fallback. Downloads are delivered unchanged. The lectern is a text rendering; images and original layouts are not reproduced there. Server-side size limits, missing mirror files, and edition-specific rights or formats can affect availability. An edition marked public domain in the U.S. may have different rights elsewhere; the index also screens named authors and other contributors with modern dates. Review the rules for the jurisdictions where the library will be deployed.

To refresh the index, fetch the documented bulk feeds and rebuild, then restart the server:

```sh
mkdir -p data
curl -fL https://gutenberg.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz -o data/gutenberg-catalog.csv.gz
curl -fL https://gutenberg.pglaf.org/cache/epub/feeds/rdf-files.tar.bz2 -o /tmp/pg-rdf.tar.bz2
python tools/index_gutenberg.py /tmp/pg-rdf.tar.bz2
```

Only `data/gutenberg-index.json.gz` is required at runtime. The bulk RDF archive is not served by Castle Library. See the [Project Gutenberg machine-readable catalog policy](https://www.gutenberg.org/policy/robot_access.html).

## Add curated editions

Verify the right to host the **specific text, translation, and cover** in the intended regions before adding them. Rights can differ by country. Add the edition to `tools/editions.tsv`; a cover requires a separately reviewed entry in `tools/cover-credits.json`. Run:

```sh
pip install requests beautifulsoup4 Pillow
python tools/import_editions.py
python tools/package_editions.py
node tools/paginate_editions.cjs
```

The first script generates gzipped source caches and edition metadata. To reimport a changed source, remove its cached `books/<id>.json.gz` before rerunning all three commands. The second creates each EPUB and adds matching cover and download links to the metadata. The last command pre-paginates the books, embeds the first two reading pages per edition in the catalog manifest, and writes small JSON segments under `pages/`. The web reader does not fetch or decompress the whole book to open it. The `books/` and `tools/` folders are needed for rebuilding, not for serving the finished site.

Artwork is not generated. The downloadable EPUBs are Castle Library text editions, not replicas of a print layout; original internal illustrations and some typography are not included. Additional names and genre tags are maintained in `catalog.js`. A reader’s study shelf, candle preference, and last reading position are stored in that browser; there is no account or cross-device sync.

## Standard Ebooks

Standard Ebooks titles are indexed from their public catalog pages in `data/standard-ebooks-index.json.gz`. Standard Ebooks' robots.txt disallows fetching `/ebooks/*/downloads/*` and `/ebooks/*/text*`, so Castle Library does not download those files. On first use, the server clones the official CC0 source repository from GitHub and builds the EPUB with Standard Ebooks' `se` tool. Built EPUBs are cached in `~/.cache/castle-library/standard-ebooks` and trimmed to 2 GB.

To enable this, install Python 3.14 or newer, then the tools:

    uv python install 3.14
    python3.14 -m venv /opt/castle-se
    /opt/castle-se/bin/pip install https://github.com/standardebooks/tools/archive/refs/heads/master.zip
    CASTLE_SE_BIN=/opt/castle-se/bin/se python server.py --port 3000

Without `CASTLE_SE_BIN` (or an `se` on the PATH), Standard Ebooks titles remain searchable but show a clear unavailable message when opened or downloaded. Rebuild the index with `python3 tools/index_standard_ebooks.py`, which reads public catalog pages politely (about 0.4 s between requests with four workers) and takes several minutes.
