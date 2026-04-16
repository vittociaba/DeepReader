import React, { useState, useEffect } from 'react';

/**
 * ForgettingCurve — Feature 8
 * SVG sparkline showing predicted retention over time with review history dots.
 *
 * Props:
 *   cardId — concept card ID
 *   compact — if true, renders as a small inline sparkline (default: false)
 */
export default function ForgettingCurve({ cardId, compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cardId) return;
    fetch(`/api/concept_cards/${cardId}/history`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading || !data || !data.history || data.history.length === 0) {
    if (compact) return null;
    return <div style={s.empty}>No review history yet</div>;
  }

  const W = compact ? 120 : 280;
  const H = compact ? 40 : 100;
  const PAD = compact ? 4 : 12;

  // Build the decay curve + review points
  const created = new Date(data.created_at).getTime();
  const now = Date.now();
  const totalDays = Math.max(7, (now - created) / (1000 * 60 * 60 * 24));

  const toX = (t) => PAD + ((t - created) / (now - created)) * (W - 2 * PAD);
  const toY = (r) => PAD + (1 - r) * (H - 2 * PAD);

  // Generate exponential decay curve segments between reviews
  const curveParts = [];
  let curStability = 1;

  // Build review events
  const reviews = data.history.map(h => ({
    time: new Date(h.reviewed_at).getTime(),
    rating: h.rating,
    success: h.rating >= 3,
  }));

  // For each segment between reviews
  const segments = [];
  let segStart = created;
  reviews.forEach((rev, i) => {
    // Decay from segStart to rev.time with current stability
    const steps = 20;
    const segPoints = [];
    for (let s = 0; s <= steps; s++) {
      const t = segStart + (rev.time - segStart) * (s / steps);
      const daysSince = (t - segStart) / (1000 * 60 * 60 * 24);
      const retention = Math.exp(-daysSince / Math.max(1, curStability));
      segPoints.push({ x: toX(t), y: toY(retention) });
    }
    segments.push(segPoints);

    // After review, stability grows based on new interval
    if (rev.success && i + 1 < reviews.length) {
      curStability = Math.max(1, (reviews[i + 1].time - rev.time) / (1000 * 60 * 60 * 24));
    } else if (rev.success) {
      curStability = data.interval || curStability * 1.5;
    } else {
      curStability = 1;
    }
    segStart = rev.time;
  });

  // Final segment: from last review to now
  const lastStability = data.interval || 1;
  const finalSteps = 20;
  const finalPoints = [];
  for (let s = 0; s <= finalSteps; s++) {
    const t = segStart + (now - segStart) * (s / finalSteps);
    const daysSince = (t - segStart) / (1000 * 60 * 60 * 24);
    const retention = Math.exp(-daysSince / Math.max(1, lastStability));
    finalPoints.push({ x: toX(t), y: toY(retention) });
  }
  segments.push(finalPoints);

  // Flatten for path
  const allPaths = segments.map(pts =>
    'M' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')
  );

  // Review dots
  const dots = reviews.map(rev => ({
    x: toX(rev.time),
    y: toY(1.0), // Reset point (retention goes back to ~100%)
    success: rev.success,
    rating: rev.rating,
  }));

  const retPct = data.predicted_retention;
  const retColor = retPct >= 80 ? 'var(--accent-green)' : retPct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {allPaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#4a9eff" strokeWidth="1.5" opacity="0.6" />
          ))}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="2" fill={d.success ? '#4adf8a' : '#ff6b6b'} />
          ))}
        </svg>
        <span style={{ fontSize: 'var(--text-xs)', color: retColor }}>~{retPct}%</span>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Forgetting Curve</span>
        <span style={{ ...s.retention, color: retColor }}>
          ~{retPct}% chance you'd recall this today
        </span>
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={s.svg}>
        {/* Decay curves */}
        {allPaths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#4a9eff" strokeWidth="2" opacity="0.5" />
        ))}
        {/* Review dots */}
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r="4"
            fill={d.success ? '#4adf8a' : '#ff6b6b'}
            stroke="#1a1714"
            strokeWidth="1"
          >
            <title>Rating: {d.rating}</title>
          </circle>
        ))}
        {/* 50% line */}
        <line x1={PAD} y1={toY(0.5)} x2={W - PAD} y2={toY(0.5)}
          stroke="#3a3630" strokeWidth="0.5" strokeDasharray="3,3" />
        <text x={W - PAD - 2} y={toY(0.5) - 3} fill="#3a3630" fontSize="8" textAnchor="end">50%</text>
      </svg>

      <div style={s.legend}>
        <span style={s.legendItem}>
          <span style={{ ...s.dot, background: 'var(--accent-green)' }} /> Successful review
        </span>
        <span style={s.legendItem}>
          <span style={{ ...s.dot, background: 'var(--accent-red)' }} /> Failed review
        </span>
        <span style={s.legendItem}>
          <span style={{ ...s.dot, background: 'var(--accent-blue)', width: '12px', height: '2px', borderRadius: '1px' }} /> Retention decay
        </span>
      </div>
    </div>
  );
}

const s = {
  container: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-md) var(--space-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.3rem',
  },
  title: {
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  retention: {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
  },
  svg: {
    display: 'block',
    background: 'var(--bg-deep)',
    borderRadius: 'var(--radius-sm)',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-lg)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  empty: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontStyle: 'italic',
  },
};
