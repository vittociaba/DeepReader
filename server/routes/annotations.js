const express = require('express');
const router = express.Router();
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');
const { parseWikiLinks, writeCard } = require('../lib/vault');

// POST /api/annotations
router.post('/', (req, res) => {
  const {
    book_id, session_id,
    chapter_index, page_index,
    paragraph_index, char_offset,
    selected_text, type,
  } = req.body;

  if (
    !book_id || !session_id ||
    chapter_index == null || page_index == null ||
    paragraph_index == null || char_offset == null ||
    !selected_text || !type
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['N', 'Q', 'C'].includes(type)) {
    return res.status(400).json({ error: 'type must be N, Q, or C' });
  }

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO annotations
      (id, book_id, session_id, chapter_index, page_index, paragraph_index,
       char_offset, selected_text, type, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
  `).run(id, book_id, session_id, chapter_index, page_index, paragraph_index,
         char_offset, selected_text, type, now);

  // Touch session last_active
  db.prepare('UPDATE sessions SET last_active = ? WHERE id = ?').run(now, session_id);

  const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  res.status(201).json(annotation);
});

// GET /api/annotations?book_id=X[&chapter=N&page=M]
router.get('/', (req, res) => {
  const { book_id, chapter, page } = req.query;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });

  const db = getDb();

  let annotations;
  if (chapter != null && page != null) {
    annotations = db.prepare(
      'SELECT * FROM annotations WHERE book_id = ? AND chapter_index = ? AND page_index = ? ORDER BY paragraph_index, char_offset'
    ).all(book_id, parseInt(chapter, 10), parseInt(page, 10));
  } else if (chapter != null) {
    annotations = db.prepare(
      'SELECT * FROM annotations WHERE book_id = ? AND chapter_index = ? ORDER BY paragraph_index, char_offset'
    ).all(book_id, parseInt(chapter, 10));
  } else {
    annotations = db.prepare(
      'SELECT * FROM annotations WHERE book_id = ? ORDER BY chapter_index, page_index, paragraph_index, char_offset'
    ).all(book_id);
  }

  res.json(annotations);
});

// PATCH /api/annotations/:id
router.patch('/:id', (req, res) => {
  const { body } = req.body;
  if (body == null) return res.status(400).json({ error: 'body required' });

  const db = getDb();
  const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  if (!annotation) return res.status(404).json({ error: 'Annotation not found' });

  db.prepare('UPDATE annotations SET body = ? WHERE id = ?').run(body, req.params.id);

  // Sync body to linked concept card if one exists
  const linkedCard = db.prepare(
    'SELECT * FROM concept_cards WHERE annotation_id = ?'
  ).get(req.params.id);
  if (linkedCard) {
    const linked_concepts = parseWikiLinks(body);
    db.prepare(
      'UPDATE concept_cards SET body = ?, linked_concepts = ? WHERE id = ?'
    ).run(body, JSON.stringify(linked_concepts), linkedCard.id);
    try {
      if (linkedCard.vault_path) try { fs.unlinkSync(linkedCard.vault_path); } catch (_) {}
      const refreshed = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(linkedCard.id);
      const newPath = writeCard(refreshed);
      db.prepare('UPDATE concept_cards SET vault_path = ? WHERE id = ?').run(newPath, linkedCard.id);
    } catch (err) {
      console.warn('vault sync warning:', err.message);
    }
  }

  res.json({ ...annotation, body });
});

// DELETE /api/annotations/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  if (!annotation) return res.status(404).json({ error: 'Annotation not found' });

  db.prepare('DELETE FROM annotations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
