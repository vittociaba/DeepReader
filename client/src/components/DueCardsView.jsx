import React, { useState, useEffect } from 'react';
import ReviewSession from './ReviewSession';
import ForgettingCurve from './ForgettingCurve';

export default function DueCardsView({ onBack }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const url = showAll ? '/api/concept_cards' : '/api/concept_cards?due=true';
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(data => setCards(Array.isArray(data) ? data : []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [showAll]);

  const dueCards = cards.filter(c => c.srs_due <= today);

  if (reviewing) {
    return (
      <div style={s.page}>
        <ReviewSession cards={dueCards} onDone={() => {
          setReviewing(false);
          fetch('/api/concept_cards?due=true')
            .then(r => r.json())
            .then(data => setCards(Array.isArray(data) ? data : []))
            .catch(() => {});
        }} />
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Review</h1>
        <label style={s.toggle}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={e => setShowAll(e.target.checked)}
            style={{ marginRight: '6px' }}
          />
          Show all
        </label>
      </div>

      {/* Stats */}
      <div style={s.statsBar}>
        <div style={s.stat}>
          <span style={{ ...s.statNum, color: 'var(--accent-blue)' }}>{dueCards.length}</span>
          <span style={s.statLabel}>due today</span>
        </div>
        <div style={s.stat}>
          <span style={s.statNum}>{cards.length}</span>
          <span style={s.statLabel}>total</span>
        </div>
        <div style={s.stat}>
          <span style={{ ...s.statNum, color: 'var(--accent-red)' }}>{cards.filter(c => c.status === 'leech').length}</span>
          <span style={s.statLabel}>leeches</span>
        </div>
        <div style={s.stat}>
          <span style={{ ...s.statNum, color: 'var(--accent-purple)' }}>{cards.filter(c => c.status === 'retired').length}</span>
          <span style={s.statLabel}>retired</span>
        </div>
        {dueCards.length > 0 && (
          <button style={s.startBtn} onClick={() => setReviewing(true)}>
            Start Review ({dueCards.length})
          </button>
        )}
      </div>

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : cards.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>▣</div>
          <div style={s.emptyTitle}>
            {showAll ? 'No concept cards yet' : 'No cards due today'}
          </div>
          <div style={s.emptyHint}>
            {showAll
              ? 'Create cards from annotations while reading.'
              : 'Great work — check back tomorrow!'}
          </div>
        </div>
      ) : (
        <div style={s.list}>
          {cards.map(card => (
            <CardRow
              key={card.id}
              card={card}
              today={today}
              onDelete={id => setCards(prev => prev.filter(c => c.id !== id))}
              onUpdate={updated => setCards(prev => prev.map(c => c.id === updated.id ? updated : c))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardRow({ card, today, onDelete, onUpdate }) {
  const isDue = card.srs_due <= today;
  const tagsArr = safeParse(card.tags, []);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);
  const [tagsInput, setTagsInput] = useState(tagsArr.join(', '));
  const [saving, setSaving] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${card.title}"?`)) return;
    await fetch(`/api/concept_cards/${card.id}`, { method: 'DELETE' });
    onDelete(card.id);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const r = await fetch(`/api/concept_cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), body: body.trim(), tags }),
    });
    const updated = await r.json();
    setSaving(false);
    if (r.ok) { onUpdate(updated); setEditing(false); }
  };

  if (editing) {
    return (
      <div style={{ ...s.row, borderLeftColor: 'var(--accent-amber)', flexDirection: 'column' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
          <input style={s.editInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" required />
          <textarea style={s.editTextarea} value={body} onChange={e => setBody(e.target.value)} rows={4} required />
          <input style={s.editInput} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="Tags (comma-separated)" />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" style={s.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" style={s.saveBtn} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    );
  }

  const borderColor = isDue ? 'var(--accent-blue)' :
    card.status === 'leech' ? 'var(--accent-red)' :
    card.status === 'retired' ? 'var(--accent-purple)' : 'var(--border)';

  return (
    <div style={{ ...s.row, borderLeftColor: borderColor }}>
      <div style={s.rowMain}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={s.rowTitle}>{card.title}</span>
          {card.status === 'leech' && <span style={s.leechTag}>leech</span>}
          {card.status === 'retired' && <span style={s.retiredTag}>retired</span>}
        </div>
        <span style={s.rowSource}>{card.source_book} — {card.source_page}</span>
        {tagsArr.length > 0 && (
          <div style={s.tags}>{tagsArr.map(t => <span key={t} style={s.tag}>{t}</span>)}</div>
        )}
      </div>
      <div style={s.rowMeta}>
        <div style={{ marginBottom: '6px', alignSelf: 'flex-end' }}>
          <ForgettingCurve cardId={card.id} compact={true} />
        </div>
        <span style={{ ...s.dueBadge, color: isDue ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
          {isDue ? 'Due' : card.srs_due}
        </span>
        <span style={s.metaText}>EF {card.srs_efactor.toFixed(1)}</span>
        <span style={s.metaText}>{card.srs_interval === 1 ? '1 day' : `${card.srs_interval} days`}</span>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          <button style={s.iconBtn} onClick={() => setEditing(true)} title="Edit">✎</button>
          <button style={{ ...s.iconBtn, color: 'var(--accent-red)' }} onClick={handleDelete} title="Delete">✕</button>
        </div>
      </div>
    </div>
  );
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_) { return fallback; }
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-xl) var(--space-2xl) var(--space-md)',
    flexShrink: 0,
  },
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  toggle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2xl)',
    padding: 'var(--space-md) var(--space-2xl) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  statNum: {
    fontSize: 'var(--text-xl)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  },
  startBtn: {
    marginLeft: 'auto',
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--accent-green)',
    padding: '8px 20px',
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-md) var(--space-2xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-sm)',
    padding: 'var(--space-2xl)',
  },
  emptyIcon: { fontSize: '2.5rem', opacity: 0.2 },
  emptyTitle: { fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-secondary)' },
  emptyHint: { fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: 'var(--bg-surface)',
    borderLeft: '3px solid',
    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
    padding: 'var(--space-md) var(--space-lg)',
    gap: 'var(--space-lg)',
    transition: 'background var(--transition-fast)',
  },
  rowMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowSource: { fontSize: 'var(--text-sm)', color: 'var(--text-muted)' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' },
  tag: {
    fontSize: 'var(--text-xs)',
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 6px',
  },
  rowMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '3px',
    flexShrink: 0,
  },
  dueBadge: { fontSize: 'var(--text-sm)', fontWeight: 600 },
  metaText: { fontSize: 'var(--text-xs)', color: 'var(--text-faint)' },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 'var(--text-base)',
    padding: '2px 4px',
    lineHeight: 1,
    fontFamily: 'var(--font-ui)',
  },
  leechTag: {
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-red)',
    background: 'var(--accent-red-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 6px',
    fontWeight: 600,
  },
  retiredTag: {
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-purple)',
    background: 'var(--accent-purple-dim)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 6px',
    fontWeight: 600,
  },
  editInput: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: '6px 8px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-ui)',
  },
  editTextarea: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: '6px 8px',
    outline: 'none',
    width: '100%',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    padding: '4px 10px',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  saveBtn: {
    background: 'var(--accent-blue-dim)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-blue)',
    padding: '4px 14px',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
};
