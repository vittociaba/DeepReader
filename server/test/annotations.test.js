/**
 * Integration tests — annotation create / read / update / delete
 *
 * Sets process.env.DB_PATH BEFORE any require that touches the DB, so the
 * singleton in migrate.js picks up the temp file.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmpDb = path.join(os.tmpdir(), `dr-ann-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

// ─── now safe to require DB-dependent modules ───────────────────────────────
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { initDb, getDb } = require('../db/migrate');
const annotationsRouter = require('../routes/annotations');
const sessionsRouter = require('../routes/sessions');

// Minimal test app
const app = express();
app.use(express.json());
app.use('/api/sessions', sessionsRouter);
app.use('/api/annotations', annotationsRouter);

let server;
let baseUrl;
const BOOK_ID = 'test-book-00000001';
let sessionId;

// ─── helpers ────────────────────────────────────────────────────────────────

async function api(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${baseUrl}${url}`, opts);
  const data = await r.json();
  return { status: r.status, body: data };
}

// ─── lifecycle ──────────────────────────────────────────────────────────────

before(async () => {
  initDb();

  // Insert prerequisite book row
  getDb().prepare(
    'INSERT INTO books (id, filename, title, author, chapter_count, imported_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(BOOK_ID, 'test.epub', 'Test Book', 'Test Author', 3, new Date().toISOString());

  // Start server on random port
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Create a session (prerequisite for annotations)
  const { body } = await api('POST', '/api/sessions', { book_id: BOOK_ID });
  sessionId = body.id;
  assert.ok(sessionId, 'session created');
});

after(() => {
  server?.close();
  try { fs.unlinkSync(tmpDb); } catch (_) {}
});

// ─── session tests ───────────────────────────────────────────────────────────

test('POST /api/sessions — creates session with correct fields', async () => {
  const { status, body } = await api('POST', '/api/sessions', { book_id: BOOK_ID });
  assert.equal(status, 201);
  assert.ok(body.id);
  assert.equal(body.book_id, BOOK_ID);
  assert.ok(body.started_at);
  assert.ok(body.last_active);
  assert.equal(body.ended_at, null);
});

test('POST /api/sessions — rejects unknown book_id', async () => {
  const { status } = await api('POST', '/api/sessions', { book_id: 'no-such-book' });
  assert.equal(status, 404);
});

test('PATCH /api/sessions/:id/touch — updates last_active', async () => {
  const { body } = await api('PATCH', `/api/sessions/${sessionId}/touch`);
  assert.equal(body.ok, true);
});

// ─── annotation CRUD tests ───────────────────────────────────────────────────

let createdId;

const BASE_ANN = () => ({
  book_id: BOOK_ID,
  session_id: sessionId,
  chapter_index: 0,
  page_index: 0,
  paragraph_index: 2,
  char_offset: 15,
  selected_text: 'The quick brown fox',
  type: 'N',
});

test('POST /api/annotations — creates annotation', async () => {
  const { status, body } = await api('POST', '/api/annotations', BASE_ANN());
  assert.equal(status, 201);
  assert.ok(body.id);
  assert.equal(body.type, 'N');
  assert.equal(body.selected_text, 'The quick brown fox');
  assert.equal(body.body, '');
  assert.equal(body.paragraph_index, 2);
  assert.equal(body.char_offset, 15);
  createdId = body.id;
});

test('POST /api/annotations — rejects invalid type', async () => {
  const { status } = await api('POST', '/api/annotations', { ...BASE_ANN(), type: 'X' });
  assert.equal(status, 400);
});

test('POST /api/annotations — rejects missing fields', async () => {
  const { status } = await api('POST', '/api/annotations', { book_id: BOOK_ID });
  assert.equal(status, 400);
});

test('GET /api/annotations — returns annotation by book+chapter+page', async () => {
  const { status, body } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=0&page=0`);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  const found = body.find(a => a.id === createdId);
  assert.ok(found, 'created annotation appears in list');
});

test('GET /api/annotations — different page returns empty', async () => {
  const { status, body } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=1&page=5`);
  assert.equal(status, 200);
  assert.deepEqual(body, []);
});

test('PATCH /api/annotations/:id — updates body', async () => {
  const { status, body } = await api('PATCH', `/api/annotations/${createdId}`, { body: 'My note body' });
  assert.equal(status, 200);
  assert.equal(body.body, 'My note body');
});

test('PATCH /api/annotations/:id — body persists on subsequent GET', async () => {
  const { body } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=0&page=0`);
  const ann = body.find(a => a.id === createdId);
  assert.equal(ann.body, 'My note body');
});

test('DELETE /api/annotations/:id — removes annotation', async () => {
  const { status, body } = await api('DELETE', `/api/annotations/${createdId}`);
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('DELETE /api/annotations/:id — gone after delete', async () => {
  const { body } = await api('GET', `/api/annotations?book_id=${BOOK_ID}&chapter=0&page=0`);
  const found = body.find(a => a.id === createdId);
  assert.equal(found, undefined, 'annotation should be gone');
});

test('DELETE /api/annotations/:id — 404 for missing id', async () => {
  const { status } = await api('DELETE', `/api/annotations/no-such-id`);
  assert.equal(status, 404);
});

test('GET /api/sessions/:id/harvest — returns session annotations', async () => {
  // Create a fresh annotation then harvest
  await api('POST', '/api/annotations', { ...BASE_ANN(), type: 'Q', selected_text: 'harvest test' });
  const { status, body } = await api('GET', `/api/sessions/${sessionId}/harvest`);
  assert.equal(status, 200);
  assert.ok(body.session);
  assert.ok(Array.isArray(body.annotations));
  assert.ok(body.annotations.length >= 1);
});
