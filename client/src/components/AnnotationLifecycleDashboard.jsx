import React, { useState, useEffect } from 'react';

/**
 * AnnotationLifecycleDashboard — Feature 3 (Collector's Fallacy Shield)
 * Shows annotation lifecycle progression: orphaned → noted → promoted → reviewed → mature.
 *
 * Props:
 *   sessionId — current session ID (optional, for session-specific stats)
 */
export default function AnnotationLifecycleDashboard({ sessionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = sessionId
      ? `/api/stats/annotation_lifecycle?session_id=${sessionId}`
      : '/api/stats/annotation_lifecycle';

    fetch(url)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading || !data || data.total === 0) return null;

  const stages = [
    { key: 'orphaned', label: 'Orphaned',  color: 'var(--accent-red)',    count: data.orphaned },
    { key: 'noted',    label: 'Noted',     color: 'var(--accent-amber)',  count: data.noted },
    { key: 'promoted', label: 'Promoted',  color: 'var(--accent-green)',  count: data.promoted },
    { key: 'reviewed', label: 'Reviewed',  color: 'var(--accent-blue)',   count: data.reviewed },
    { key: 'mature',   label: 'Mature',    color: 'var(--accent-purple)', count: data.mature },
  ];

  const total = data.total || 1;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Annotation Lifecycle</span>
        {data.last_week_retention != null && (
          <span style={s.retention}>
            Last week's card retention: <strong style={{ color: retColor(data.last_week_retention) }}>
              {data.last_week_retention}%
            </strong>
          </span>
        )}
      </div>

      {/* Stacked bar */}
      <div style={s.bar}>
        {stages.map(st => st.count > 0 && (
          <div
            key={st.key}
            style={{
              ...s.barSlice,
              width: `${(st.count / total) * 100}%`,
              background: st.color,
            }}
            title={`${st.label}: ${st.count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={s.legend}>
        {stages.map(st => (
          <div key={st.key} style={s.legendItem}>
            <div style={{ ...s.legendDot, background: st.color }} />
            <span style={s.legendLabel}>{st.count} {st.label}</span>
          </div>
        ))}
      </div>

      <p style={s.hint}>
        Fewer, deeper annotations beat more, shallower ones.
      </p>
    </div>
  );
}

function retColor(pct) {
  if (pct >= 80) return 'var(--accent-green)';
  if (pct >= 60) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

const s = {
  container: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 'var(--space-sm)',
  },
  title: {
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  retention: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  },
  bar: {
    display: 'flex',
    height: '12px',
    borderRadius: 'var(--radius-pill)',
    overflow: 'hidden',
    background: 'var(--bg-hover)',
  },
  barSlice: {
    height: '100%',
    transition: 'width 0.3s ease',
    minWidth: '4px',
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
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  },
  hint: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontStyle: 'italic',
    margin: 0,
  },
};
