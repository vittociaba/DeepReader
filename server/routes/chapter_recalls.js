const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');

// POST /api/chapter_recalls
router.post('/', (req, res) => {
  const { book_id, chapter_index, recall_text } = req.body;

  if (!book_id || chapter_index == null || !recall_text) {
    return res.status(400).json({ error: 'book_id, chapter_index, recall_text required' });
  }

  const db = getDb();
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO chapter_recalls (id, book_id, chapter_index, recall_text, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, book_id, chapter_index, recall_text, now);

  res.status(201).json({ id, book_id, chapter_index, recall_text, created_at: now, revised_at: null });
});

// GET /api/chapter_recalls?book_id=X&chapter=N
router.get('/', (req, res) => {
  const { book_id, chapter } = req.query;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });

  const db = getDb();

  if (chapter != null) {
    const recalls = db.prepare(
      'SELECT * FROM chapter_recalls WHERE book_id = ? AND chapter_index = ? ORDER BY created_at DESC'
    ).all(book_id, parseInt(chapter, 10));
    return res.json(recalls);
  }

  const recalls = db.prepare(
    'SELECT * FROM chapter_recalls WHERE book_id = ? ORDER BY chapter_index, created_at DESC'
  ).all(book_id);
  res.json(recalls);
});

// PATCH /api/chapter_recalls/:id — revise a previous recall
router.patch('/:id', (req, res) => {
  const { recall_text } = req.body;
  if (!recall_text) return res.status(400).json({ error: 'recall_text required' });

  const db = getDb();
  const recall = db.prepare('SELECT * FROM chapter_recalls WHERE id = ?').get(req.params.id);
  if (!recall) return res.status(404).json({ error: 'Recall not found' });

  const now = new Date().toISOString();
  db.prepare('UPDATE chapter_recalls SET recall_text = ?, revised_at = ? WHERE id = ?')
    .run(recall_text, now, req.params.id);

  res.json({ ...recall, recall_text, revised_at: now });
});

module.exports = router;
