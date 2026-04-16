const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');
const { parseAndPaginate, getPageData, getToc, getChapterText, getChapterHtmlContent, invalidateCache } = require('../lib/epub-parser');

const LIBRARY_PATH = process.env.LIBRARY_PATH || path.join(__dirname, '../../data/library');

if (!fs.existsSync(LIBRARY_PATH)) {
  try { fs.mkdirSync(LIBRARY_PATH, { recursive: true }); } catch (_) {}
}

const storage = multer.diskStorage({
  destination: LIBRARY_PATH,
  filename: (req, _file, cb) => {
    const id = uuidv4();
    req.generatedBookId = id;
    cb(null, `${id}.epub`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.epub')) cb(null, true);
    else cb(new Error('Only .epub files are accepted'));
  },
});

// GET /api/books
router.get('/', (_req, res) => {
  const books = getDb().prepare('SELECT * FROM books ORDER BY imported_at DESC').all();
  res.json(books);
});

// POST /api/books/upload
router.post('/upload', upload.single('epub'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const bookId = req.generatedBookId;
  const epubPath = path.join(LIBRARY_PATH, req.file.filename);

  try {
    // Insert book row first so FK constraint is satisfied when pages are inserted
    getDb().prepare(
      'INSERT INTO books (id, filename, title, author, chapter_count, imported_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(bookId, req.file.filename, 'Importing…', '', 0, new Date().toISOString());

    const { title, author, chapterCount } = await parseAndPaginate(epubPath, bookId, getDb());

    getDb().prepare(
      'UPDATE books SET title = ?, author = ?, chapter_count = ? WHERE id = ?'
    ).run(title, author, chapterCount, bookId);

    res.json({ id: bookId, title, author, chapter_count: chapterCount });
  } catch (err) {
    try { fs.unlinkSync(epubPath); } catch (_) {}
    try { getDb().prepare('DELETE FROM books WHERE id = ?').run(bookId); } catch (_) {}
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id
router.get('/:id', (req, res) => {
  const book = getDb().prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

// PATCH /api/books/:id — update tags
router.patch('/:id', (req, res) => {
  const { tags } = req.body;
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' });
  const db = getDb();
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  db.prepare('UPDATE books SET tags = ? WHERE id = ?').run(JSON.stringify(tags), req.params.id);
  res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id));
});

// GET /api/books/:id/export — all annotations + highlights as markdown
router.get('/:id/export', (req, res) => {
  const db = getDb();
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const annotations = db.prepare(`
    SELECT type, body, selected_text, chapter_index, page_index, paragraph_index
    FROM annotations WHERE book_id = ?
    ORDER BY chapter_index, page_index, paragraph_index
  `).all(req.params.id);

  const highlights = db.prepare(`
    SELECT selected_text, chapter_index, page_index
    FROM highlights WHERE book_id = ?
    ORDER BY chapter_index, page_index
  `).all(req.params.id);

  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `# ${book.title || 'Untitled'}`,
    book.author ? `*${book.author}*` : '',
    '',
    `*Exported ${today}*`,
    '',
    '---',
    '',
  ];

  if (highlights.length > 0) {
    lines.push('## Highlights', '');
    for (const h of highlights) {
      if (h.selected_text) {
        lines.push(`- "${h.selected_text}" *(Ch ${h.chapter_index + 1}, p ${h.page_index + 1})*`);
      }
    }
    lines.push('');
  }

  const TYPE_LABEL = { N: 'Notes', Q: 'Questions', C: 'Concepts' };
  for (const type of ['N', 'Q', 'C']) {
    const group = annotations.filter(a => a.type === type);
    if (group.length === 0) continue;
    lines.push(`## ${TYPE_LABEL[type]}`, '');
    for (const a of group) {
      lines.push(`### Ch ${a.chapter_index + 1}, p ${a.page_index + 1}`);
      if (a.selected_text) lines.push(`> ${a.selected_text}`);
      if (a.body && a.body.trim()) lines.push('', a.body.trim());
      lines.push('');
    }
  }

  // Collapse consecutive blank lines
  const md = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  res.type('text/plain').send(md);
});

// DELETE /api/books/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  invalidateCache(req.params.id);
  try { fs.unlinkSync(path.join(LIBRARY_PATH, book.filename)); } catch (_) {}
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/books/:id/pages?chapter=N&page=M
router.get('/:id/pages', async (req, res) => {
  const chapterIndex = parseInt(req.query.chapter ?? '0', 10);
  const pageIndex = parseInt(req.query.page ?? '0', 10);

  const book = getDb().prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const epubPath = path.join(LIBRARY_PATH, book.filename);

  try {
    const data = await getPageData(epubPath, req.params.id, chapterIndex, pageIndex, getDb());
    if (!data) return res.status(404).json({ error: 'Page not found' });
    res.json(data);
  } catch (err) {
    console.error('Page fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id/toc
router.get('/:id/toc', async (req, res) => {
  const book = getDb().prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const epubPath = path.join(LIBRARY_PATH, book.filename);

  try {
    const toc = await getToc(epubPath, req.params.id, getDb());
    res.json(toc);
  } catch (err) {
    console.error('TOC error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id/chapter/:chapterIndex/html
// Returns full chapter HTML with data-para-index attributes for client-side pagination
router.get('/:id/chapter/:chapterIndex/html', async (req, res) => {
  const chapterIndex = parseInt(req.params.chapterIndex, 10);
  const book = getDb().prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const epubPath = path.join(LIBRARY_PATH, book.filename);
  try {
    const [chapterData, toc] = await Promise.all([
      getChapterHtmlContent(epubPath, req.params.id, chapterIndex),
      getToc(epubPath, req.params.id, getDb()),
    ]);
    const title = toc[chapterIndex]?.title || `Chapter ${chapterIndex + 1}`;
    const chapterCount = toc.length;
    res.json({
      html: chapterData.html,
      paragraph_count: chapterData.paragraph_count,
      chapter_index: chapterIndex,
      chapter_count: chapterCount,
      title,
    });
  } catch (err) {
    console.error('Chapter HTML error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id/chapter/:chapterIndex/text
// Returns { text, title, chapter_index } for clipboard copy or client-side download
router.get('/:id/chapter/:chapterIndex/text', async (req, res) => {
  const chapterIndex = parseInt(req.params.chapterIndex, 10);

  const book = getDb().prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const epubPath = path.join(LIBRARY_PATH, book.filename);

  try {
    const [text, toc] = await Promise.all([
      getChapterText(epubPath, req.params.id, chapterIndex),
      getToc(epubPath, req.params.id, getDb()),
    ]);
    const title = toc[chapterIndex]?.title || `Chapter ${chapterIndex + 1}`;
    res.json({ text, title, chapter_index: chapterIndex });
  } catch (err) {
    console.error('Chapter text error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
