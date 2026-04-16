const express = require('express');
const router = express.Router();
const { getDb } = require('../db/migrate');

// POST /api/reading_time — log time spent on a page
router.post('/', (req, res) => {
  const { session_id, book_id, chapter_index, page_index, seconds_spent } = req.body;

  if (!session_id || !book_id || chapter_index == null || page_index == null || !seconds_spent) {
    return res.status(400).json({ error: 'session_id, book_id, chapter_index, page_index, seconds_spent required' });
  }

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO reading_time (session_id, book_id, chapter_index, page_index, seconds_spent, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(session_id, book_id, chapter_index, page_index, seconds_spent, now);

  res.status(201).json({ ok: true });
});

// GET /api/reading_time/stats?book_id=X — per-chapter time aggregates
router.get('/stats', (req, res) => {
  const { book_id } = req.query;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });

  const db = getDb();

  // Aggregate seconds per chapter and count distinct pages
  const chapters = db.prepare(`
    SELECT chapter_index,
           SUM(seconds_spent) as total_seconds,
           COUNT(DISTINCT page_index) as pages_read
    FROM reading_time
    WHERE book_id = ?
    GROUP BY chapter_index
    ORDER BY chapter_index
  `).all(book_id);

  // Get retention data: for cards sourced from this book, compute avg performance
  const retention = db.prepare(`
    SELECT cc.source_page,
           AVG(CASE WHEN rh.rating >= 3 THEN 1.0 ELSE 0.0 END) as retention_rate,
           COUNT(rh.id) as review_count
    FROM concept_cards cc
    JOIN review_history rh ON rh.card_id = cc.id
    WHERE cc.source_book = (SELECT title FROM books WHERE id = ?)
    GROUP BY cc.source_page
  `).all(book_id);

  // Build retention by chapter from source_page (format: "chN pM")
  const retentionByChapter = {};
  for (const r of retention) {
    const match = r.source_page.match(/ch(\d+)/);
    if (match) {
      const ci = parseInt(match[1], 10) - 1; // 0-indexed
      if (!retentionByChapter[ci]) {
        retentionByChapter[ci] = { total_rate: 0, count: 0 };
      }
      retentionByChapter[ci].total_rate += r.retention_rate * r.review_count;
      retentionByChapter[ci].count += r.review_count;
    }
  }

  const stats = chapters.map(ch => {
    const avgSecondsPerPage = ch.pages_read > 0
      ? Math.round(ch.total_seconds / ch.pages_read)
      : 0;
    const ret = retentionByChapter[ch.chapter_index];
    const retentionRate = ret && ret.count > 0
      ? Math.round((ret.total_rate / ret.count) * 100)
      : null;

    return {
      chapter_index: ch.chapter_index,
      total_seconds: ch.total_seconds,
      pages_read: ch.pages_read,
      avg_seconds_per_page: avgSecondsPerPage,
      retention_percent: retentionRate,
    };
  });

  // Compute summary: fast vs slow reading retention
  let fastPages = { retention_sum: 0, count: 0 };
  let slowPages = { retention_sum: 0, count: 0 };

  for (const s of stats) {
    if (s.retention_percent == null) continue;
    if (s.avg_seconds_per_page < 60) {
      fastPages.retention_sum += s.retention_percent;
      fastPages.count++;
    } else if (s.avg_seconds_per_page > 180) {
      slowPages.retention_sum += s.retention_percent;
      slowPages.count++;
    }
  }

  res.json({
    chapters: stats,
    summary: {
      fast_reading_retention: fastPages.count > 0
        ? Math.round(fastPages.retention_sum / fastPages.count)
        : null,
      slow_reading_retention: slowPages.count > 0
        ? Math.round(slowPages.retention_sum / slowPages.count)
        : null,
    },
  });
});

module.exports = router;
