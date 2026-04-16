const express = require('express');
const router = express.Router();
const { getDb } = require('../db/migrate');

// GET /api/search?q=
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ error: 'q must be at least 2 characters' });

  const db = getDb();
  const pattern = `%${q}%`;

  const annotations = db.prepare(`
    SELECT a.id, a.type, a.body, a.chapter_index, a.page_index, a.book_id,
           b.title as book_title
    FROM annotations a
    JOIN books b ON b.id = a.book_id
    WHERE a.body LIKE ?
    ORDER BY a.book_id, a.chapter_index, a.page_index
    LIMIT 30
  `).all(pattern);

  const cards = db.prepare(`
    SELECT id, title, body, source_book, source_page, status, tags
    FROM concept_cards
    WHERE title LIKE ? OR body LIKE ? OR tags LIKE ?
    ORDER BY source_book
    LIMIT 30
  `).all(pattern, pattern, pattern);

  const vocab = db.prepare(`
    SELECT id, word, translation, context, language, book_id
    FROM vocab_cards
    WHERE word LIKE ? OR translation LIKE ? OR context LIKE ?
    ORDER BY language, word
    LIMIT 30
  `).all(pattern, pattern, pattern);

  res.json({
    query: q,
    annotations,
    cards,
    vocab,
  });
});

module.exports = router;
