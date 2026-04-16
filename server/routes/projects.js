const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');

// GET /api/projects
router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*, COUNT(pb.book_id) as book_count
    FROM projects p
    LEFT JOIN project_books pb ON pb.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at
  `).all();
  res.json(projects);
});

// POST /api/projects
router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO projects (id, name, color, created_at) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), color || '#4a9eff', new Date().toISOString());
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/projects/:id/books
router.get('/:id/books', (req, res) => {
  const db = getDb();
  const books = db.prepare(`
    SELECT b.* FROM books b
    JOIN project_books pb ON pb.book_id = b.id
    WHERE pb.project_id = ?
    ORDER BY pb.added_at
  `).all(req.params.id);
  res.json(books);
});

// POST /api/projects/:id/books  { book_id }
router.post('/:id/books', (req, res) => {
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });
  const db = getDb();
  try {
    db.prepare('INSERT OR IGNORE INTO project_books (project_id, book_id, added_at) VALUES (?, ?, ?)')
      .run(req.params.id, book_id, new Date().toISOString());
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/books/:bookId
router.delete('/:id/books/:bookId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_books WHERE project_id = ? AND book_id = ?')
    .run(req.params.id, req.params.bookId);
  res.json({ ok: true });
});

// GET /api/projects/:id/concepts — shared tags across books in project
router.get('/:id/concepts', (req, res) => {
  const db = getDb();
  const books = db.prepare(`
    SELECT b.title FROM books b
    JOIN project_books pb ON pb.book_id = b.id
    WHERE pb.project_id = ?
  `).all(req.params.id);

  if (books.length === 0) return res.json({ tags: [], cards: [] });

  const titles = books.map(b => b.title);
  const placeholders = titles.map(() => '?').join(',');

  const cards = db.prepare(`
    SELECT id, title, tags, source_book, status, srs_interval
    FROM concept_cards
    WHERE source_book IN (${placeholders})
    ORDER BY source_book
  `).all(...titles);

  // Count tag frequency across all cards in project
  const tagCount = {};
  for (const card of cards) {
    const tags = safeParse(card.tags, []);
    for (const t of tags) {
      tagCount[t] = (tagCount[t] || 0) + 1;
    }
  }
  const tags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));

  res.json({ tags, cards });
});

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_) { return fallback; }
}

module.exports = router;
