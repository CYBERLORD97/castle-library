// Build small, independently loadable reading spreads from the full text archive.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const manifest = path.join(root, 'editions.js');
const books = JSON.parse(fs.readFileSync(manifest,'utf8').split('const LECTERN_EDITIONS = ')[1].trim().replace(/;$/, ''));
const CHUNK_SIZE = 48;
function paginate(blocks) {
  const pages = [];
  let current = [], size = 0;
  const flush = () => { if (current.length) pages.push(current); current = []; size = 0; };
  for (const [kind, text] of blocks) {
    const chunks = text.match(/.{1,690}(?=\s|$)\s*|.{1,690}/gsu) || [];
    if (kind === 'heading' && size > 450) flush();
    for (const chunk of chunks) {
      const weight = chunk.length + (kind === 'heading' ? 90 : 28) + (chunk.match(/\n/g) || []).length * 20;
      if (size && size + weight > 850 && current.at(-1)[0] !== 'heading') flush();
      current.push([kind, chunk.trim()]);
      size += weight;
    }
  }
  flush();
  return pages;
}
let chunkCount = 0;
for (const book of books) {
  const {blocks} = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'books',`${book.id}.json.gz`))));
  const pages = paginate(blocks);
  const dir = path.join(root, 'pages', book.id);
  fs.mkdirSync(dir,{recursive:true});
  book.pageCount = pages.length;
  book.pageChunkSize = CHUNK_SIZE;
  book.startPages = pages.slice(0, 2);
  for (let offset = 0; offset < pages.length; offset += CHUNK_SIZE) {
    fs.writeFileSync(path.join(dir, `${offset / CHUNK_SIZE}.json`), JSON.stringify(pages.slice(offset,offset+CHUNK_SIZE)));
    chunkCount++;
  }
  for (const file of fs.readdirSync(dir)) {
    if (/^\d+\.json$/.test(file) && Number(file.split('.')[0]) >= Math.ceil(pages.length/CHUNK_SIZE)) fs.unlinkSync(path.join(dir,file));
  }
}
fs.writeFileSync(manifest, '/* Built by tools/import_editions.py, package_editions.py, and paginate_editions.cjs. */\nconst LECTERN_EDITIONS = ' + JSON.stringify(books,null,2) + ';\n');
console.log(`${books.length} paginated books, ${chunkCount} small reading files`);
