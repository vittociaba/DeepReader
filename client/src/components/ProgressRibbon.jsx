import React from 'react';

export default function ProgressRibbon({ toc, chapterIndex, pageIndex, onNavigate }) {
  if (!toc || toc.length === 0) return <div style={s.ribbon} />;

  const totalPages = toc.reduce((sum, ch) => sum + ch.page_count, 0);
  const offsets = [];
  let acc = 0;
  for (const ch of toc) {
    offsets.push(acc);
    acc += ch.page_count;
  }

  const currentAbsolute = offsets[chapterIndex] + pageIndex;
  const progress = totalPages > 0 ? currentAbsolute / Math.max(totalPages - 1, 1) : 0;

  return (
    <div style={s.ribbon} title="Book progress">
      <div style={s.track}>
        <div style={{ ...s.fill, height: `${progress * 100}%` }} />
        {offsets.slice(1).map((offset, i) => {
          const pct = totalPages > 1 ? offset / (totalPages - 1) : 0;
          return (
            <div
              key={i + 1}
              style={{ ...s.chapterMark, top: `${pct * 100}%` }}
              title={toc[i + 1].title}
              onClick={() => onNavigate(i + 1, 0)}
            />
          );
        })}
        <div style={{ ...s.cursor, top: `${progress * 100}%` }} />
      </div>
      <div style={s.pct}>{Math.round(progress * 100)}%</div>
    </div>
  );
}

const s = {
  ribbon: {
    width: '24px',
    flexShrink: 0,
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 0 6px',
    gap: '6px',
  },
  track: {
    flex: 1,
    width: '4px',
    background: 'var(--border)',
    borderRadius: '2px',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    background: 'var(--accent-blue)',
    borderRadius: '2px',
    transition: 'height var(--transition-slow)',
  },
  chapterMark: {
    position: 'absolute',
    left: '-4px',
    right: '-4px',
    height: '2px',
    background: 'var(--text-faint)',
    cursor: 'pointer',
    zIndex: 1,
  },
  cursor: {
    position: 'absolute',
    left: '-5px',
    width: '14px',
    height: '5px',
    background: 'var(--text-primary)',
    borderRadius: '2px',
    transform: 'translateY(-50%)',
    zIndex: 2,
    boxShadow: 'var(--shadow-sm)',
  },
  pct: {
    fontSize: '0.55rem',
    color: 'var(--text-faint)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
};
