const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

// Setup environment before requiring anything that connects to DB
const dbPath = path.join(__dirname, '..', '..', 'data', 'test.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
process.env.DB_PATH = dbPath;

const app = require('../index');
const { getDb, initDb } = require('../db/migrate');

// Setup test database
test.before(async () => {
  initDb(); // Runs all migrations including the new ones
});

test('Learning features integration tests', async (t) => {
  let bookId, cardId, sessionId;

  await t.test('POST /api/books/upload — setup test book', async () => {
    const db = getDb();
    db.prepare(`
      INSERT INTO books (id, title, author, filename, chapter_count, imported_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('b1', 'Test Book', 'Author', 'dummy.epub', 3, new Date().toISOString());

    bookId = 'b1';
  });

  await t.test('POST /api/sessions — setup test session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ book_id: bookId });
    if (res.status !== 201) console.error('SESSION ERROR:', res.body);
    assert.strictEqual(res.status, 201);
    sessionId = res.body.id;
  });

  await t.test('POST /api/concept_cards — setup test card', async () => {
    const res = await request(app)
      .post('/api/concept_cards')
      .send({
        title: 'Spaced Repetition',
        source_book: 'Test Book',
        source_page: 'ch1 p1',
        body: 'The {{c1::spacing effect}} improves retention.',
        tags: ['memory']
      });
    assert.strictEqual(res.status, 201);
    cardId = res.body.id;
  });

  // Feature 1: Chapter Recall Gate
  let recallId;
  await t.test('POST /api/chapter_recalls — save recall', async () => {
    const res = await request(app)
      .post('/api/chapter_recalls')
      .send({ book_id: bookId, chapter_index: 0, recall_text: 'The brain remembers by retrieving.' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.recall_text, 'The brain remembers by retrieving.');
    recallId = res.body.id;
  });

  await t.test('GET /api/chapter_recalls — fetch recalls', async () => {
    const res = await request(app).get(`/api/chapter_recalls?book_id=${bookId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].id, recallId);
  });

  // Feature 7: Reading time tracking
  await t.test('POST /api/reading_time — log time', async () => {
    const res = await request(app)
      .post('/api/reading_time')
      .send({
        session_id: sessionId,
        book_id: bookId,
        chapter_index: 0,
        page_index: 0,
        seconds_spent: 120, // 2 mins
      });
    assert.strictEqual(res.status, 201);
  });

  await t.test('GET /api/reading_time/stats — velocity vs retention', async () => {
    const res = await request(app).get(`/api/reading_time/stats?book_id=${bookId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.chapters.length, 1);
    assert.strictEqual(res.body.chapters[0].total_seconds, 120);
    assert.strictEqual(res.body.chapters[0].pages_read, 1);
  });

  // Features 2, 6, 8, 10: Review tracking, leech/retire detection, calibration, formatting curve
  await t.test('PATCH /api/concept_cards/:id/review — confidence tracking', async () => {
    const res = await request(app)
      .patch(`/api/concept_cards/${cardId}/review`)
      .send({ rating: 4, confidence: 3, review_mode: 'cloze' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.review_count, 1);
    assert.strictEqual(res.body.success_streak, 1);
    assert.strictEqual(res.body.fail_count, 0);
  });

  await t.test('GET /api/concept_cards/:id/history — review history formatting curve', async () => {
    const res = await request(app).get(`/api/concept_cards/${cardId}/history`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.history.length, 1);
    assert.strictEqual(res.body.history[0].confidence, 3);
    assert.notStrictEqual(res.body.predicted_retention, null); // roughly 100% just after review
  });

  await t.test('PATCH /api/concept_cards/:id/review — leech detection', async () => {
    // Fail it 4 times
    for (let i = 0; i < 4; i++) {
      await request(app).patch(`/api/concept_cards/${cardId}/review`).send({ rating: 2 });
    }
    const db = getDb();
    const card = db.prepare('SELECT status FROM concept_cards WHERE id = ?').get(cardId);
    assert.strictEqual(card.status, 'leech');
  });

  await t.test('GET /api/stats/calibration — confidence curve', async () => {
    const res = await request(app).get('/api/stats/calibration');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.body.calibration_curve), true);
    // Should have 1 data point for confidence level 3
    const p = res.body.calibration_curve.find(c => c.confidence === 3);
    assert.strictEqual(p.total_reviews, 1);
  });

  // Feature 4: Concept Graph
  await t.test('GET /api/concept_cards/graph — graph nodes/edges', async () => {
    const res = await request(app).get('/api/concept_cards/graph');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.nodes.length, 1);
    assert.strictEqual(res.body.edges.length, 0); // No links yet
    assert.strictEqual(res.body.nodes[0].status, 'leech'); // verify status included
  });
});
