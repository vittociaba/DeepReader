const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');

// GET /api/highlights?book_id=X&chapter=N&page=M
router.get('/', (req, res) => {
  const { book_id, chapter, page } = req.query;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });

  let query = 'SELECT * FROM highlights WHERE book_id = ?';
  const params = [book_id];
  if (chapter !== undefined) { query += ' AND chapter_index = ?'; params.push(parseInt(chapter, 10)); }
  if (page !== undefined) { query += ' AND page_index = ?'; params.push(parseInt(page, 10)); }

  try {
    const rows = getDb().prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/highlights
router.post('/', (req, res) => {
  const { book_id, chapter_index, page_index, paragraph_index, char_offset, length, selected_text } = req.body;
  if (!book_id || chapter_index == null || page_index == null || paragraph_index == null ||
      char_offset == null || length == null || !selected_text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  const created_at = new Date().toISOString();
  try {
    getDb().prepare(
      `INSERT INTO highlights
        (id, book_id, chapter_index, page_index, paragraph_index, char_offset, length, selected_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, book_id, chapter_index, page_index, paragraph_index, char_offset, length, selected_text, created_at);
    res.json({ id, book_id, chapter_index, page_index, paragraph_index, char_offset, length, selected_text, created_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/highlights/:id
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM highlights WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
