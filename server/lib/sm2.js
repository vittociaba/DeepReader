/**
 * SM-2 spaced repetition algorithm.
 * Pure function — no side effects, no external dependencies.
 * Do not modify without explicit instruction.
 *
 * @param {{ interval: number, efactor: number }} card
 * @param {number} rating  - integer 1–5
 * @param {Date}   [today] - override for deterministic testing (default: new Date())
 * @returns {{ new_interval: number, new_efactor: number, due_date: string }}
 */
function sm2(card, rating, today = new Date()) {
  const { interval, efactor } = card;
  let new_interval, new_efactor;

  if (rating >= 3) {
    if (interval === 1) {
      new_interval = 1;
    } else if (interval === 2) {
      new_interval = 6;
    } else {
      new_interval = Math.round(interval * efactor);
    }
    new_efactor = efactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    new_efactor = Math.max(1.3, new_efactor);
  } else {
    // rating < 3 — forgot
    new_interval = 1;
    new_efactor = Math.max(1.3, efactor - 0.2);
  }

  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + new_interval);
  const due_date = [
    due.getFullYear(),
    String(due.getMonth() + 1).padStart(2, '0'),
    String(due.getDate()).padStart(2, '0'),
  ].join('-');

  return { new_interval, new_efactor, due_date };
}

module.exports = { sm2 };
