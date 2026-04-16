const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');
const { sm2 } = require('../lib/sm2');

// GET /api/vocab?q=&lang=en|it|all
router.get('/', (req, res) => {
  const { q, lang } = req.query;
  const db = getDb();

  const conditions = [];
  const params = [];

  if (q && q.trim()) {
    const pattern = `%${q.trim()}%`;
    conditions.push('(word LIKE ? OR translation LIKE ? OR context LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  if (lang && lang !== 'all') {
    conditions.push('language = ?');
    params.push(lang);
  }

  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  const cards = db.prepare(`SELECT * FROM vocab_cards${where} ORDER BY created_at DESC`).all(...params);
  res.json(cards);
});

// GET /api/vocab/due
router.get('/due', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const cards = db.prepare('SELECT * FROM vocab_cards WHERE srs_due <= ? ORDER BY srs_due').all(today);
  res.json(cards);
});

// POST /api/vocab
router.post('/', (req, res) => {
  const { word, translation, context, book_id, source_page, language } = req.body;
  if (!word || !word.trim()) return res.status(400).json({ error: 'word required' });

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  db.prepare(`
    INSERT INTO vocab_cards (id, word, translation, context, book_id, source_page, language, srs_interval, srs_efactor, srs_due, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 2.5, ?, ?)
  `).run(
    id,
    word.trim(),
    translation ? translation.trim() : null,
    context ? context.trim() : null,
    book_id || null,
    source_page || null,
    language || 'en',
    today,
    now
  );

  res.status(201).json(db.prepare('SELECT * FROM vocab_cards WHERE id = ?').get(id));
});

// PATCH /api/vocab/:id
router.patch('/:id', (req, res) => {
  const { word, translation, context, language } = req.body;
  if (!word || !word.trim()) return res.status(400).json({ error: 'word required' });
  const db = getDb();
  db.prepare(`
    UPDATE vocab_cards SET word = ?, translation = ?, context = ?, language = ? WHERE id = ?
  `).run(word.trim(), translation ? translation.trim() : null, context ? context.trim() : null, language || 'en', req.params.id);
  res.json(db.prepare('SELECT * FROM vocab_cards WHERE id = ?').get(req.params.id));
});

// PATCH /api/vocab/:id/review  { rating: 1-5 }
router.patch('/:id/review', (req, res) => {
  const rating = parseInt(req.body.rating, 10);
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating 1–5 required' });

  const db = getDb();
  const card = db.prepare('SELECT * FROM vocab_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Not found' });

  const { new_interval, new_efactor, due_date } = sm2(
    { interval: card.srs_interval, efactor: card.srs_efactor },
    rating
  );
  db.prepare('UPDATE vocab_cards SET srs_interval = ?, srs_efactor = ?, srs_due = ? WHERE id = ?')
    .run(new_interval, new_efactor, due_date, card.id);
  res.json(db.prepare('SELECT * FROM vocab_cards WHERE id = ?').get(card.id));
});

// DELETE /api/vocab/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM vocab_cards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
