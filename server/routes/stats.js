const express = require('express');
const router = express.Router();
const { getDb } = require('../db/migrate');

// GET /api/stats/calibration — confidence vs actual performance
router.get('/calibration', (req, res) => {
  const db = getDb();

  const rows = db.prepare(`
    SELECT confidence, rating
    FROM review_history
    WHERE confidence IS NOT NULL
    ORDER BY reviewed_at
  `).all();

  if (rows.length === 0) {
    return res.json({ data_points: [], calibration_curve: [] });
  }

  // Group by confidence level (1–5), compute % correct (rating >= 3)
  const buckets = {};
  for (let c = 1; c <= 5; c++) buckets[c] = { correct: 0, total: 0 };

  for (const r of rows) {
    if (r.confidence >= 1 && r.confidence <= 5) {
      buckets[r.confidence].total++;
      if (r.rating >= 3) buckets[r.confidence].correct++;
    }
  }

  const calibration_curve = Object.entries(buckets).map(([confidence, data]) => ({
    confidence: parseInt(confidence, 10),
    actual_correct_pct: data.total > 0 ? Math.round((data.correct / data.total) * 100) : null,
    total_reviews: data.total,
  }));

  res.json({
    total_data_points: rows.length,
    calibration_curve,
  });
});

// GET /api/stats/annotation_lifecycle?session_id=X
router.get('/annotation_lifecycle', (req, res) => {
  const { session_id } = req.query;
  const db = getDb();

  // Count annotations by their lifecycle stage
  let annotations;
  if (session_id) {
    annotations = db.prepare('SELECT * FROM annotations WHERE session_id = ?').all(session_id);
  } else {
    annotations = db.prepare('SELECT * FROM annotations').all();
  }

  let orphaned = 0;  // highlighted but no body (note)
  let noted = 0;     // has body but not promoted to card
  let promoted = 0;  // became a concept card
  let reviewed = 0;  // card has been through at least one SRS cycle
  let mature = 0;    // card has survived multiple successful reviews

  for (const ann of annotations) {
    const card = db.prepare(
      'SELECT * FROM concept_cards WHERE annotation_id = ?'
    ).get(ann.id);

    if (!card) {
      if (!ann.body || ann.body.trim() === '') {
        orphaned++;
      } else {
        noted++;
      }
    } else {
      // Has a linked card — check its maturity
      const reviewCount = card.review_count || 0;
      if (reviewCount === 0) {
        promoted++;
      } else if (card.srs_interval > 21 && reviewCount >= 3) {
        mature++;
      } else {
        reviewed++;
      }
    }
  }

  // Get retention % for cards created in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentReviews = db.prepare(`
    SELECT AVG(CASE WHEN rating >= 3 THEN 1.0 ELSE 0.0 END) as retention
    FROM review_history
    WHERE reviewed_at >= ?
  `).get(weekAgo);

  res.json({
    orphaned,
    noted,
    promoted,
    reviewed,
    mature,
    total: annotations.length,
    last_week_retention: recentReviews.retention != null
      ? Math.round(recentReviews.retention * 100)
      : null,
  });
});

// GET /api/stats/consistency — days active per week trend
router.get('/consistency', (req, res) => {
  const db = getDb();

  // Get all session dates grouped by ISO week
  const sessions = db.prepare(`
    SELECT DATE(started_at) as day
    FROM sessions
    WHERE started_at IS NOT NULL
    GROUP BY DATE(started_at)
    ORDER BY day
  `).all();

  if (sessions.length === 0) {
    return res.json({ weeks: [], avg_days_per_week: 0 });
  }

  // Group by week (ISO week number)
  const weeks = {};
  for (const s of sessions) {
    const d = new Date(s.day);
    // Get ISO week start (Monday)
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff)).toISOString().slice(0, 10);
    if (!weeks[weekStart]) weeks[weekStart] = new Set();
    weeks[weekStart].add(s.day);
  }

  const weekData = Object.entries(weeks).map(([week_start, days]) => ({
    week_start,
    days_active: days.size,
  }));

  const avg = weekData.length > 0
    ? Math.round((weekData.reduce((s, w) => s + w.days_active, 0) / weekData.length) * 10) / 10
    : 0;

  res.json({
    weeks: weekData,
    avg_days_per_week: avg,
  });
});

// GET /api/stats/streak — consecutive reading days + today's time
router.get('/streak', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const days = db.prepare(`
    SELECT DISTINCT DATE(recorded_at) as day
    FROM reading_time
    ORDER BY day DESC
  `).all().map(r => r.day);

  let streak = 0;
  let current = today;
  for (const day of days) {
    if (day === current) {
      streak++;
      const d = new Date(current + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      current = d.toISOString().slice(0, 10);
    } else if (day < current) {
      break;
    }
  }

  const todayRow = db.prepare(`
    SELECT COALESCE(SUM(seconds_spent), 0) as total
    FROM reading_time WHERE DATE(recorded_at) = ?
  `).get(today);

  res.json({ streak, today_seconds: todayRow.total });
});

module.exports = router;
