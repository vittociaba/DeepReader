/**
 * Mobile functionality tests — verifies API endpoints that mobile UI depends on.
 *
 * Covers: session keep-alive, annotation CRUD (floating toolbar),
 * highlight creation, and page-level data isolation.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmpDb = path.join(os.tmpdir(), `dr-mobile-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { initDb, getDb } = require('../db/migrate');

const app = express();
app.use(express.json());
app.use('/api/annotations', require('../routes/annotations'));
app.use('/api/sessions', require('../routes/sessions'));
app.use('/api/highlights', require('../routes/highlights'));

let server;
let baseUrl;
const BOOK_ID = 'mobile-test-book-001';
let sessionId;

async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${baseUrl}${url}`, opts);
  const data = await r.json();
  return { status: r.status, body: data };
}

before(async () => {
  initDb();
  getDb().prepare(
    'INSERT INTO books (id, filename, title, author, chapter_count, imported_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(BOOK_ID, 'test.epub', 'Mobile Test Book', 'Test Author', 3, new Date().toISOString());

  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Create session (required for annotations)
  const { body } = await api('POST', '/api/sessions', { book_id: BOOK_ID });
  sessionId = body.id;
  assert.ok(sessionId, 'session created');
});

after(() => {
  server?.close();
  try { fs.unlinkSync(tmpDb); } catch (_) {}
});

// ─── Session keep-alive (mobile uses this on resume) ──────────────────────

test('PATCH /api/sessions/:id/touch — keeps session alive', async () => {
  const { status, body } = await api('PATCH', `/api/sessions/${sessionId}/touch`);
  assert.equal(status, 200);
  assert.equal(body.ok, true, 'session touch should return ok');
  assert.equal(body.ended, undefined, 'active session should not be ended');
});

// ─── Annotation CRUD (mobile floating toolbar) ───────────────────────────

test('POST /api/annotations — create Note annotation', async () => {
  const { status, body } = await api('POST', '/api/annotations', {
    book_id: BOOK_ID, session_id: sessionId,
    chapter_index: 0, page_index: 0,
    paragraph_index: 2, char_offset: 10,
    selected_text: 'important concept', type: 'N',
  });
  assert.equal(status, 201);
  assert.ok(body.id);
  assert.equal(body.type, 'N');
  assert.equal(body.selected_text, 'important concept');
});

test('POST /api/annotations — create Question annotation', async () => {
  const { status, body } = await api('POST', '/api/annotations', {
    book_id: BOOK_ID, session_id: sessionId,
    chapter_index: 0, page_index: 0,
    paragraph_index: 3, char_offset: 5,
    selected_text: 'why does this happen?', type: 'Q',
  });
  assert.equal(status, 201);
  assert.equal(body.type, 'Q');
});

test('POST /api/annotations — create Concept annotation', async () => {
  const { status, body } = await api('POST', '/api/annotations', {
    book_id: BOOK_ID, session_id: sessionId,
    chapter_index: 0, page_index: 0,
    paragraph_index: 1, char_offset: 0,
    selected_text: 'spaced repetition', type: 'C',
  });
  assert.equal(status, 201);
  assert.equal(body.type, 'C');
});

test('GET /api/annotations — fetch page annotations for mobile panel', async () => {
  const { status, body } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=0&page=0`);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 3, 'should have 3 annotations on page 0');
});

test('PATCH /api/annotations/:id — update annotation body from mobile', async () => {
  const { body: annotations } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=0&page=0`);
  const ann = annotations[0];
  const { status } = await api('PATCH', `/api/annotations/${ann.id}`, { body: 'Mobile note body' });
  assert.equal(status, 200);
});

test('DELETE /api/annotations/:id — delete annotation from mobile', async () => {
  const { body: before } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=0&page=0`);
  const last = before[before.length - 1];
  const { status } = await api('DELETE', `/api/annotations/${last.id}`);
  assert.equal(status, 200);

  const { body: after } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=0&page=0`);
  assert.equal(after.length, 2, 'should have 2 annotations after delete');
});

// ─── Highlight workflow (mobile floating toolbar) ─────────────────────────

test('POST /api/highlights — create highlight from mobile', async () => {
  const { status, body } = await api('POST', '/api/highlights', {
    book_id: BOOK_ID, chapter_index: 0, page_index: 0,
    paragraph_index: 1, char_offset: 5, length: 15,
    selected_text: 'highlighted text',
  });
  assert.equal(status, 200);
  assert.ok(body.id);
  assert.equal(body.length, 15);
});

test('GET /api/highlights — fetch page highlights for mobile', async () => {
  const { status, body } = await api('GET', `/api/highlights?book_id=${BOOK_ID}&chapter=0&page=0`);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length >= 1);
});

// ─── Page isolation (mobile navigation) ───────────────────────────────────

test('annotations are isolated by page (mobile swipe navigation)', async () => {
  const { body } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=1&page=0`);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0, 'different page should have no annotations');
});

test('highlights are isolated by page (mobile swipe navigation)', async () => {
  const { body } = await api('GET', `/api/highlights?book_id=${BOOK_ID}&chapter=1&page=0`);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0, 'different page should have no highlights');
});
