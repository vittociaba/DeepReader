const express = require('express');
const router = express.Router();
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/migrate');
const { sm2 } = require('../lib/sm2');
const { parseWikiLinks, writeCard, verifyFrontmatter } = require('../lib/vault');

// POST /api/concept_cards
router.post('/', (req, res) => {
  const { annotation_id, title, source_book, source_page, body, tags } = req.body;

  if (!title || !source_book || !source_page || !body) {
    return res.status(400).json({ error: 'title, source_book, source_page, body required' });
  }

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Extract [[wiki-links]] from the card body automatically
  const linked_concepts = parseWikiLinks(body);

  db.prepare(`
    INSERT INTO concept_cards
      (id, annotation_id, title, source_book, source_page, body, tags, linked_concepts,
       srs_interval, srs_efactor, srs_due, created_at, vault_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 2.5, ?, ?, '')
  `).run(
    id,
    annotation_id || null,
    title,
    source_book,
    source_page,
    body,
    JSON.stringify(tags || []),
    JSON.stringify(linked_concepts),
    today,
    now
  );

  const card = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(id);

  // Write markdown file to /data/vault; update vault_path in DB
  let vaultPath = '';
  let verify = { ok: false, missing: [] };
  try {
    vaultPath = writeCard(card);
    db.prepare('UPDATE concept_cards SET vault_path = ? WHERE id = ?').run(vaultPath, id);
    verify = verifyFrontmatter(vaultPath);
  } catch (err) {
    // Non-fatal: card is in DB even if file write fails (e.g. in dev without /data/vault)
    console.warn('vault write warning:', err.message);
  }

  const updated = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(id);
  res.status(201).json({ ...updated, vault_verify: verify });
});

// GET /api/concept_cards?due=true
router.get('/', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const cards = req.query.due === 'true'
    ? db.prepare('SELECT * FROM concept_cards WHERE srs_due <= ? ORDER BY srs_due').all(today)
    : db.prepare('SELECT * FROM concept_cards ORDER BY srs_due').all();

  res.json(cards);
});

// POST /api/concept_cards/bulk — bulk operations on multiple cards
router.post('/bulk', (req, res) => {
  const { action, ids, payload } = req.body;
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'action and non-empty ids array required' });
  }

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');

  if (action === 'delete') {
    const cards = db.prepare(`SELECT id, vault_path FROM concept_cards WHERE id IN (${placeholders})`).all(...ids);
    const del = db.transaction(() => {
      for (const card of cards) {
        if (card.vault_path) try { fs.unlinkSync(card.vault_path); } catch (_) {}
        db.prepare('DELETE FROM review_history WHERE card_id = ?').run(card.id);
        db.prepare('DELETE FROM concept_cards WHERE id = ?').run(card.id);
      }
    });
    del();
    return res.json({ ok: true, affected: cards.length });
  }

  if (action === 'reset_srs') {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(
      `UPDATE concept_cards SET srs_interval = 1, srs_efactor = 2.5, srs_due = ?,
       review_count = 0, fail_count = 0, success_streak = 0, status = 'active'
       WHERE id IN (${placeholders})`
    ).run(today, ...ids);
    return res.json({ ok: true, affected: ids.length });
  }

  if (action === 'set_status') {
    const { status } = payload || {};
    if (!['active', 'leech', 'retired'].includes(status)) {
      return res.status(400).json({ error: 'status must be active, leech, or retired' });
    }
    db.prepare(`UPDATE concept_cards SET status = ? WHERE id IN (${placeholders})`).run(status, ...ids);
    return res.json({ ok: true, affected: ids.length });
  }

  if (action === 'add_tag') {
    const { tag } = payload || {};
    if (!tag || !tag.trim()) return res.status(400).json({ error: 'tag required' });
    const cards = db.prepare(`SELECT id, tags FROM concept_cards WHERE id IN (${placeholders})`).all(...ids);
    const update = db.transaction(() => {
      for (const card of cards) {
        const tags = safeParse(card.tags, []);
        if (!tags.includes(tag.trim())) {
          tags.push(tag.trim());
          db.prepare('UPDATE concept_cards SET tags = ? WHERE id = ?').run(JSON.stringify(tags), card.id);
        }
      }
    });
    update();
    return res.json({ ok: true, affected: cards.length });
  }

  if (action === 'remove_tag') {
    const { tag } = payload || {};
    if (!tag || !tag.trim()) return res.status(400).json({ error: 'tag required' });
    const cards = db.prepare(`SELECT id, tags FROM concept_cards WHERE id IN (${placeholders})`).all(...ids);
    const update = db.transaction(() => {
      for (const card of cards) {
        const tags = safeParse(card.tags, []).filter(t => t !== tag.trim());
        db.prepare('UPDATE concept_cards SET tags = ? WHERE id = ?').run(JSON.stringify(tags), card.id);
      }
    });
    update();
    return res.json({ ok: true, affected: cards.length });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
});

// GET /api/concept_cards/graph — all cards with link data for force-directed graph
router.get('/graph', (req, res) => {
  const db = getDb();
  const cards = db.prepare(
    'SELECT id, title, source_book, tags, linked_concepts, status, srs_interval FROM concept_cards'
  ).all();

  // Build nodes and edges
  const nodes = cards.map(c => ({
    id: c.id,
    title: c.title,
    source_book: c.source_book,
    tags: safeParse(c.tags, []),
    status: c.status,
    interval: c.srs_interval,
    connections: safeParse(c.linked_concepts, []).length,
  }));

  // Build edges from linked_concepts (wiki-links)
  const titleToId = {};
  for (const c of cards) {
    titleToId[c.title.toLowerCase()] = c.id;
  }

  const edges = [];
  for (const c of cards) {
    const links = safeParse(c.linked_concepts, []);
    for (const link of links) {
      const targetId = titleToId[link.toLowerCase()];
      if (targetId && targetId !== c.id) {
        edges.push({ source: c.id, target: targetId });
      }
    }
  }

  res.json({ nodes, edges });
});

// GET /api/concept_cards/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const card = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(card);
});

// PATCH /api/concept_cards/:id  — update title, body, tags
router.patch('/:id', (req, res) => {
  if (req.path.endsWith('/review')) return; // handled below
  const { title, body, tags } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  const db = getDb();
  const card = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const linked_concepts = parseWikiLinks(body);
  db.prepare(
    'UPDATE concept_cards SET title = ?, body = ?, tags = ?, linked_concepts = ? WHERE id = ?'
  ).run(title, body, JSON.stringify(tags || []), JSON.stringify(linked_concepts), card.id);

  const updated = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(card.id);

  try {
    if (updated.vault_path) try { fs.unlinkSync(updated.vault_path); } catch (_) {}
    const newPath = writeCard(updated);
    db.prepare('UPDATE concept_cards SET vault_path = ? WHERE id = ?').run(newPath, card.id);
    updated.vault_path = newPath;
  } catch (err) {
    console.warn('vault rewrite warning:', err.message);
  }

  res.json(updated);
});

// PATCH /api/concept_cards/:id/review  — apply SM-2 rating
router.patch('/:id/review', (req, res) => {
  const rating = parseInt(req.body.rating, 10);
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be integer 1–5' });
  }

  const confidence = req.body.confidence != null ? parseInt(req.body.confidence, 10) : null;
  const review_mode = req.body.review_mode || 'cloze';

  const db = getDb();
  const card = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const { new_interval, new_efactor, due_date } = sm2(
    { interval: card.srs_interval, efactor: card.srs_efactor },
    rating
  );

  // Update SRS fields
  db.prepare(`
    UPDATE concept_cards SET srs_interval = ?, srs_efactor = ?, srs_due = ? WHERE id = ?
  `).run(new_interval, new_efactor, due_date, card.id);

  // Insert review history
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO review_history (card_id, rating, confidence, review_mode, reviewed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(card.id, rating, confidence, review_mode, now);

  // Update tracking counters
  const newReviewCount = (card.review_count || 0) + 1;
  const newFailCount = rating < 3 ? (card.fail_count || 0) + 1 : (card.fail_count || 0);
  const newSuccessStreak = rating >= 3 ? (card.success_streak || 0) + 1 : 0;

  // Leech detection: fail_count >= 4
  // Retirement: review_count >= 8 AND interval > 90 AND success_streak >= 3
  let newStatus = card.status || 'active';
  if (newFailCount >= 4) {
    newStatus = 'leech';
  } else if (newReviewCount >= 8 && new_interval > 90 && newSuccessStreak >= 3) {
    newStatus = 'retired';
  } else if (newStatus === 'leech' && newSuccessStreak >= 2) {
    // Allow recovery from leech status after 2 consecutive successes
    newStatus = 'active';
  }

  db.prepare(`
    UPDATE concept_cards
    SET review_count = ?, fail_count = ?, success_streak = ?, status = ?
    WHERE id = ?
  `).run(newReviewCount, newFailCount, newSuccessStreak, newStatus, card.id);

  const updated = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(card.id);
  res.json(updated);
});



// GET /api/concept_cards/:id/history — review history for forgetting curve
router.get('/:id/history', (req, res) => {
  const db = getDb();
  const card = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const history = db.prepare(
    'SELECT * FROM review_history WHERE card_id = ? ORDER BY reviewed_at'
  ).all(req.params.id);

  // Compute predicted retention right now using exponential decay
  let predictedRetention = null;
  if (history.length > 0) {
    const lastReview = new Date(history[history.length - 1].reviewed_at);
    const daysSince = (Date.now() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
    const stability = card.srs_interval || 1;
    // Exponential decay: R = e^(-t/S) where S is stability (interval)
    predictedRetention = Math.round(Math.exp(-daysSince / stability) * 100);
    predictedRetention = Math.max(0, Math.min(100, predictedRetention));
  }

  res.json({
    card_id: card.id,
    title: card.title,
    interval: card.srs_interval,
    efactor: card.srs_efactor,
    created_at: card.created_at,
    history,
    predicted_retention: predictedRetention,
  });
});

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_) { return fallback; }
}

// DELETE /api/concept_cards/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const card = db.prepare('SELECT * FROM concept_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  if (card.vault_path) try { fs.unlinkSync(card.vault_path); } catch (_) {}
  db.prepare('DELETE FROM review_history WHERE card_id = ?').run(card.id);
  db.prepare('DELETE FROM concept_cards WHERE id = ?').run(card.id);
  res.json({ ok: true });
});

module.exports = router;
