const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// POST /api/sessions
router.post('/', (req, res) => {
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });

  const db = getDb();
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO sessions (id, book_id, started_at, last_active) VALUES (?, ?, ?, ?)'
  ).run(id, book_id, now, now);

  res.status(201).json({ id, book_id, started_at: now, last_active: now, ended_at: null });
});

// PATCH /api/sessions/:id/touch
router.patch('/:id/touch', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.ended_at) return res.json({ ended: true, session_id: session.id });

  const now = new Date();
  const idleMs = now.getTime() - new Date(session.last_active).getTime();

  if (idleMs > IDLE_TIMEOUT_MS) {
    db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?')
      .run(now.toISOString(), session.id);
    return res.json({ ended: true, session_id: session.id });
  }

  db.prepare('UPDATE sessions SET last_active = ? WHERE id = ?')
    .run(now.toISOString(), session.id);
  res.json({ ok: true, session_id: session.id });
});

// GET /api/sessions/:id/harvest
router.get('/:id/harvest', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const annotations = db.prepare(
    'SELECT * FROM annotations WHERE session_id = ? ORDER BY chapter_index, page_index, paragraph_index, char_offset'
  ).all(req.params.id);

  res.json({ session, annotations });
});

module.exports = router;
