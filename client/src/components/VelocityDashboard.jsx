import React, { useState, useEffect } from 'react';

/**
 * VelocityDashboard — Feature 7
 * Reading Velocity vs. Retention: bar chart comparing time-per-page with card retention.
 *
 * Props:
 *   bookId — optional, filter to a specific book
 *   onBack — return to previous view
 */
export default function VelocityDashboard({ bookId, onBack }) {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(bookId || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load book list
  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(b => {
        setBooks(Array.isArray(b) ? b : []);
        if (!selectedBook && b.length > 0) setSelectedBook(b[0].id);
      })
      .catch(() => setBooks([]));
  }, []);

  // Load velocity data
  useEffect(() => {
    if (!selectedBook) return;
    setLoading(true);
    fetch(`/api/reading_time/stats?book_id=${selectedBook}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedBook]);

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <h1 style={s.header}>Velocity</h1>
        <select
          style={s.bookSelect}
          value={selectedBook}
          onChange={e => setSelectedBook(e.target.value)}
        >
          {books.map(b => (
            <option key={b.id} value={b.id}>
              {b.title || 'Untitled'}
            </option>
          ))}
        </select>
      </div>

      <div style={s.body}>
        {loading && <div style={s.center}>Loading…</div>}
        {!loading && !data && <div style={s.center}>No reading time data yet.</div>}
        {!loading && data && (
          <>
            {/* Summary insight */}
            {data.summary && (data.summary.fast_reading_retention != null || data.summary.slow_reading_retention != null) && (
              <div style={s.insight}>
                {data.summary.slow_reading_retention != null && (
                  <span>
                    Chapters you spent <strong style={{ color: 'var(--accent-green)' }}>&gt;3 min/page</strong> on:
                    <strong style={{ color: 'var(--accent-green)' }}> {data.summary.slow_reading_retention}%</strong> card retention.
                  </span>
                )}
                {data.summary.fast_reading_retention != null && (
                  <span>
                    Chapters you spent <strong style={{ color: 'var(--accent-red)' }}>&lt;1 min/page</strong> on:
                    <strong style={{ color: 'var(--accent-red)' }}> {data.summary.fast_reading_retention}%</strong> card retention.
                  </span>
                )}
              </div>
            )}

            {/* Chapter bars */}
            <div style={s.chart}>
              {data.chapters.length === 0 ? (
                <div style={s.center}>No chapters with reading time data.</div>
              ) : (
                data.chapters.map(ch => {
                  const minutesPerPage = ch.avg_seconds_per_page / 60;
                  const barWidth = Math.min(100, (minutesPerPage / 5) * 100);
                  const speedColor = minutesPerPage >= 3 ? 'var(--accent-green)'
                    : minutesPerPage >= 1 ? 'var(--accent-amber)'
                    : 'var(--accent-red)';

                  return (
                    <div key={ch.chapter_index} style={s.chapterRow}>
                      <div style={s.chapterLabel}>
                        <span style={s.chapterNum}>Ch {ch.chapter_index + 1}</span>
                        <span style={s.chapterMeta}>
                          {minutesPerPage.toFixed(1)} min/page · {ch.pages_read} pages
                        </span>
                      </div>
                      <div style={s.bars}>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${barWidth}%`, background: speedColor }} />
                        </div>
                        {ch.retention_percent != null && (
                          <div style={s.retBar}>
                            <div style={{
                              ...s.retFill,
                              width: `${ch.retention_percent}%`,
                              background: ch.retention_percent >= 70 ? 'var(--accent-green-muted)' : 'var(--accent-red-muted)',
                            }} />
                            <span style={s.retLabel}>{ch.retention_percent}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Legend */}
            <div style={s.legend}>
              <span style={s.legendItem}>
                <span style={{ ...s.dot, background: 'var(--accent-green)' }} /> ≥3 min/page (deep)
              </span>
              <span style={s.legendItem}>
                <span style={{ ...s.dot, background: 'var(--accent-amber)' }} /> 1–3 min/page
              </span>
              <span style={s.legendItem}>
                <span style={{ ...s.dot, background: 'var(--accent-red)' }} /> &lt;1 min/page (fast)
              </span>
            </div>

            <p style={s.note}>
              No prescriptive "slow down!" here — just the data, presented honestly.
              Let the numbers calibrate your reading pace.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  page: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-base)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-lg)',
    padding: 'var(--space-xl) var(--space-2xl) var(--space-md)',
    flexShrink: 0,
  },
  header: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.02em',
    fontFamily: 'var(--font-ui)',
    flex: 1,
  },
  bookSelect: {
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    fontSize: 'var(--text-sm)',
    maxWidth: '240px',
    fontFamily: 'var(--font-ui)',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-lg) var(--space-2xl)',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xl)',
    boxSizing: 'border-box',
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  insight: {
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green-muted)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-lg) var(--space-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    fontSize: 'var(--text-sm)',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  chart: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  chapterRow: {
    display: 'flex',
    gap: 'var(--space-lg)',
    alignItems: 'center',
  },
  chapterLabel: {
    width: '140px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  chapterNum: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
  },
  chapterMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-ui)',
  },
  bars: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  barTrack: {
    height: '14px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 'var(--radius-sm)',
    transition: 'var(--transition)',
  },
  retBar: {
    height: '10px',
    background: 'var(--bg-deep)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    position: 'relative',
  },
  retFill: {
    height: '100%',
    borderRadius: 'var(--radius-sm)',
  },
  retLabel: {
    position: 'absolute',
    right: '4px',
    top: '-1px',
    fontSize: '0.6rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-lg)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  note: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontStyle: 'italic',
    margin: 0,
    lineHeight: 1.5,
    fontFamily: 'var(--font-ui)',
  },
};
