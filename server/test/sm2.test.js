/**
 * Unit tests — SM-2 pure function
 * Covers all rating values, EFactor boundaries, and new-card defaults.
 * Run: node --test server/test/sm2.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sm2 } = require('../lib/sm2');

// Fixed "today" so due_date assertions are deterministic
const TODAY = new Date(2026, 2, 24); // 2026-03-24 local

// ─── helpers ────────────────────────────────────────────────────────────────

function approx(actual, expected, msg) {
  assert.ok(
    Math.abs(actual - expected) < 0.0001,
    `${msg}: expected ${expected}, got ${actual}`
  );
}

// ─── rating 1 and 2 (forgot) ─────────────────────────────────────────────────

test('rating 1 — interval resets to 1', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 1, TODAY);
  assert.equal(r.new_interval, 1);
});

test('rating 1 — efactor decreases by 0.2', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 1, TODAY);
  approx(r.new_efactor, 2.3, 'efactor');
});

test('rating 1 — due_date is tomorrow', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 1, TODAY);
  assert.equal(r.due_date, '2026-03-25');
});

test('rating 2 — interval resets to 1', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 2, TODAY);
  assert.equal(r.new_interval, 1);
});

test('rating 2 — efactor decreases by 0.2', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 2, TODAY);
  approx(r.new_efactor, 2.3, 'efactor');
});

// ─── EFactor floor at 1.3 ────────────────────────────────────────────────────

test('efactor floors at 1.3 — does not go below on failure', () => {
  const r = sm2({ interval: 1, efactor: 1.4 }, 1, TODAY);
  assert.equal(r.new_efactor, 1.3);
});

test('efactor already at 1.3 — stays at 1.3 on failure', () => {
  const r = sm2({ interval: 1, efactor: 1.3 }, 2, TODAY);
  assert.equal(r.new_efactor, 1.3);
});

test('efactor floors at 1.3 on rating 3 with low efactor', () => {
  // efactor + delta could still be >= 1.3, just verify floor works when needed
  const r = sm2({ interval: 6, efactor: 1.3 }, 3, TODAY);
  assert.ok(r.new_efactor >= 1.3, 'efactor must not go below 1.3');
});

// ─── rating 3, 4, 5 (remembered) — interval progression ─────────────────────

test('rating 5 — interval=1 stays at 1 (new card first review)', () => {
  const r = sm2({ interval: 1, efactor: 2.5 }, 5, TODAY);
  assert.equal(r.new_interval, 1);
});

test('rating 5 — interval=2 grows to 6', () => {
  const r = sm2({ interval: 2, efactor: 2.5 }, 5, TODAY);
  assert.equal(r.new_interval, 6);
  assert.equal(r.due_date, '2026-03-30');
});

test('rating 5 — interval=6 grows to round(6 * 2.5) = 15', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 5, TODAY);
  assert.equal(r.new_interval, 15);
  assert.equal(r.due_date, '2026-04-08');
});

test('rating 5 — interval=15 grows to round(15 * 2.6) = 39', () => {
  // After a 5-rating, efactor went from 2.5 to 2.6, so use 2.6 here
  const r = sm2({ interval: 15, efactor: 2.6 }, 5, TODAY);
  assert.equal(r.new_interval, Math.round(15 * 2.6));
});

// ─── efactor formula for each passing rating ─────────────────────────────────

test('rating 3 — efactor decreases by 0.14', () => {
  // delta = 0.1 - (5-3)*(0.08 + (5-3)*0.02) = 0.1 - 2*(0.08+0.04) = 0.1 - 0.24 = -0.14
  const r = sm2({ interval: 6, efactor: 2.5 }, 3, TODAY);
  approx(r.new_efactor, 2.36, 'efactor rating=3');
});

test('rating 4 — efactor unchanged (delta = 0)', () => {
  // delta = 0.1 - (5-4)*(0.08 + (5-4)*0.02) = 0.1 - 1*(0.08+0.02) = 0.1 - 0.1 = 0
  const r = sm2({ interval: 6, efactor: 2.5 }, 4, TODAY);
  approx(r.new_efactor, 2.5, 'efactor rating=4');
});

test('rating 5 — efactor increases by 0.1', () => {
  // delta = 0.1 - (5-5)*(0.08 + (5-5)*0.02) = 0.1
  const r = sm2({ interval: 6, efactor: 2.5 }, 5, TODAY);
  approx(r.new_efactor, 2.6, 'efactor rating=5');
});

// ─── EFactor growth ceiling (not hardcoded in spec, but should be reasonable) ─

test('efactor grows by exactly 0.1 per rating-5 review (no hidden cap)', () => {
  // rating=5 delta = 0.1 - 0*(0.08+0) = 0.1, so each pass adds exactly 0.1
  let card = { interval: 6, efactor: 2.5 };
  for (let i = 1; i <= 5; i++) {
    const r = sm2(card, 5, TODAY);
    approx(r.new_efactor, 2.5 + i * 0.1, `efactor after ${i} rating-5 reviews`);
    card = { interval: r.new_interval, efactor: r.new_efactor };
  }
});

// ─── new card defaults ────────────────────────────────────────────────────────

test('new card — rating 1: reset', () => {
  const r = sm2({ interval: 1, efactor: 2.5 }, 1, TODAY);
  assert.equal(r.new_interval, 1);
  approx(r.new_efactor, 2.3, 'efactor');
});

test('new card — rating 3: pass, interval stays 1', () => {
  const r = sm2({ interval: 1, efactor: 2.5 }, 3, TODAY);
  assert.equal(r.new_interval, 1);
  approx(r.new_efactor, 2.36, 'efactor');
});

test('new card — rating 5: pass, efactor increases', () => {
  const r = sm2({ interval: 1, efactor: 2.5 }, 5, TODAY);
  assert.equal(r.new_interval, 1);
  approx(r.new_efactor, 2.6, 'efactor');
});

// ─── due_date arithmetic ─────────────────────────────────────────────────────

test('due_date = today + new_interval days (rating 5, interval=6)', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 5, TODAY);
  // new_interval = 15, 2026-03-24 + 15 = 2026-04-08
  assert.equal(r.due_date, '2026-04-08');
});

test('due_date = today + 1 day on failure', () => {
  const r = sm2({ interval: 6, efactor: 2.5 }, 1, TODAY);
  assert.equal(r.due_date, '2026-03-25');
});
