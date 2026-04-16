import React, { useState, useEffect, useCallback } from 'react';

export default function VocabView({ onBack }) {
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [lang, setLang]       = useState('all');
  const [flipped, setFlipped] = useState(new Set());
  const [editing, setEditing] = useState(null); // card id being edited

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim().length >= 2) params.set('q', query.trim());
    if (lang !== 'all') params.set('lang', lang);
    fetch(`/api/vocab?${params}`)
      .then(r => r.json())
      .then(data => setCards(Array.isArray(data) ? data : []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [query, lang]);

  useEffect(() => { load(); }, [load]);

  // Debounce query changes
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteCard = async (id) => {
    if (!window.confirm('Delete this vocab card?')) return;
    await fetch(`/api/vocab/${id}`, { method: 'DELETE' });
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const today = new Date().toISOString().slice(0, 10);
  const dueCount = cards.filter(c => c.srs_due <= today).length;

  const enCount = cards.filter(c => c.language === 'en').length;
  const itCount = cards.filter(c => c.language === 'it').length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Vocabulary</h1>
        <span style={s.countBadge}>{cards.length} words</span>
      </div>

      {/* Stats bar */}
      <div style={s.statsBar}>
        <div style={s.stat}>
          <span style={{ ...s.statNum, color: 'var(--accent-blue)' }}>{dueCount}</span>
          <span style={s.statLabel}>due today</span>
        </div>
        <div style={s.stat}>
          <span style={s.statNum}>{enCount}</span>
          <span style={s.statLabel}>EN</span>
        </div>
        <div style={s.stat}>
          <span style={s.statNum}>{itCount}</span>
          <span style={s.statLabel}>IT</span>
        </div>
      </div>

      {/* Search + filter */}
      <div style={s.filterBar}>
        <input
          style={s.searchInput}
          placeholder="Search word or translation… (EN or IT)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div style={s.langToggle}>
          {['all', 'en', 'it'].map(l => (
            <button
              key={l}
              style={{ ...s.langBtn, ...(lang === l ? s.langBtnActive : {}) }}
              onClick={() => setLang(l)}
            >
              {l === 'all' ? 'All' : l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : cards.length === 0 ? (
        <div style={s.empty}>
          {query.trim().length >= 2
            ? `No vocab cards match "${query}"`
            : 'No vocabulary cards yet. Double-click any word while reading to add it.'}
        </div>
      ) : (
        <div style={s.list}>
          {cards.map(card => {
            const isFlipped = flipped.has(card.id);
            const isDue = card.srs_due <= today;
            if (editing === card.id) {
              return <VocabEditRow key={card.id} card={card} onSave={updated => {
                setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
                setEditing(null);
              }} onCancel={() => setEditing(null)} />;
            }
            return (
              <div
                key={card.id}
                style={{
                  ...s.card,
                  borderLeftColor: card.language === 'it' ? 'var(--accent-green)' : 'var(--accent-blue)',
                  ...(isDue ? { borderLeftColor: 'var(--accent-amber)' } : {}),
                }}
              >
                <div style={s.cardTop} onClick={() => setFlipped(prev => {
                  const s = new Set(prev); s.has(card.id) ? s.delete(card.id) : s.add(card.id); return s;
                })}>
                  <div style={s.wordRow}>
                    <span style={s.word}>{card.word}</span>
                    <span style={{ ...s.langPill, background: card.language === 'it' ? 'var(--accent-green-dim)' : 'var(--accent-blue-dim)', color: card.language === 'it' ? 'var(--accent-green)' : 'var(--accent-blue)' }}>
                      {card.language === 'it' ? '🇮🇹' : '🇬🇧'} {card.language.toUpperCase()}
                    </span>
                    {isDue && <span style={s.duePill}>Due</span>}
                  </div>
                  <div style={s.srsRow}>
                    <span style={s.srsMeta}>interval {card.srs_interval}d · EF {card.srs_efactor.toFixed(1)}</span>
                    <span style={s.flipHint}>{isFlipped ? 'hide' : 'show translation'}</span>
                  </div>
                </div>

                {isFlipped && (
                  <div style={s.revealed}>
                    {card.translation
                      ? <div style={s.translation}>{card.translation}</div>
                      : <div style={{ color: 'var(--text-faint)', fontStyle: 'italic', fontSize: 'var(--text-sm)' }}>No translation yet</div>
                    }
                    {card.context && <div style={s.context}>"{card.context}"</div>}
                    <div style={s.ratingRow}>
                      {[1, 2, 3, 4, 5].map(r => (
                        <button
                          key={r}
                          style={{ ...s.ratingBtn, ...(r >= 3 ? s.ratingGood : s.ratingBad) }}
                          onClick={async () => {
                            const res = await fetch(`/api/vocab/${card.id}/review`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ rating: r }),
                            });
                            const updated = await res.json();
                            setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
                            setFlipped(prev => { const s = new Set(prev); s.delete(card.id); return s; });
                          }}
                        >{r}</button>
                      ))}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', alignSelf: 'center', marginLeft: 'var(--space-xs)', fontFamily: 'var(--font-ui)' }}>rate recall</span>
                    </div>
                  </div>
                )}

                <div style={s.actions}>
                  <button style={s.iconBtn} onClick={() => setEditing(card.id)} title="Edit">✎</button>
                  <button style={{ ...s.iconBtn, color: 'var(--accent-red)' }} onClick={() => deleteCard(card.id)} title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VocabEditRow({ card, onSave, onCancel }) {
  const [word, setWord]           = useState(card.word);
  const [translation, setTrans]   = useState(card.translation || '');
  const [context, setContext]     = useState(card.context || '');
  const [language, setLanguage]   = useState(card.language || 'en');
  const [saving, setSaving]       = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch(`/api/vocab/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word.trim(), translation: translation.trim(), context: context.trim(), language }),
    });
    const updated = await r.json();
    setSaving(false);
    if (r.ok) onSave(updated);
  };

  return (
    <form onSubmit={handleSave} style={{ ...s.card, borderLeftColor: 'var(--accent-amber)', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
        <input style={se.input} value={word} onChange={e => setWord(e.target.value)} placeholder="Word" required />
        <select style={se.select} value={language} onChange={e => setLanguage(e.target.value)}>
          <option value="en">EN</option>
          <option value="it">IT</option>
        </select>
      </div>
      <input style={se.input} value={translation} onChange={e => setTrans(e.target.value)} placeholder="Translation" />
      <input style={se.input} value={context} onChange={e => setContext(e.target.value)} placeholder="Context sentence" />
      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
        <button type="button" style={se.cancelBtn} onClick={onCancel}>Cancel</button>
        <button type="submit" style={se.saveBtn} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
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
  countBadge: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-ui)',
  },
  statsBar: {
    display: 'flex',
    gap: 'var(--space-2xl)',
    padding: 'var(--space-md) var(--space-2xl)',
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
    fontFamily: 'var(--font-ui)',
  },
  statLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-ui)',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-2xl)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '180px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
  },
  langToggle: {
    display: 'flex',
    gap: 'var(--space-xs)',
  },
  langBtn: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    padding: 'var(--space-xs) var(--space-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-ui)',
  },
  langBtnActive: {
    background: 'var(--accent-blue-dim)',
    border: '1px solid var(--accent-blue)',
    color: 'var(--accent-blue)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-md) var(--space-2xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
    borderLeft: '3px solid',
    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
    overflow: 'hidden',
    position: 'relative',
  },
  cardTop: {
    padding: 'var(--space-sm) var(--space-lg)',
    cursor: 'pointer',
  },
  wordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    marginBottom: '2px',
  },
  word: {
    fontWeight: 700,
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    flex: 1,
    fontFamily: 'var(--font-ui)',
  },
  langPill: {
    fontSize: 'var(--text-xs)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px var(--space-xs)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  duePill: {
    fontSize: 'var(--text-xs)',
    background: 'var(--accent-amber-muted)',
    color: 'var(--accent-amber)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px var(--space-xs)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  srsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  srsMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-ui)',
  },
  flipHint: {
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-blue)',
    fontFamily: 'var(--font-ui)',
  },
  revealed: {
    borderTop: '1px solid var(--border-subtle)',
    padding: 'var(--space-sm) var(--space-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  translation: {
    fontSize: 'var(--text-base)',
    color: 'var(--accent-green)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  context: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  ratingRow: {
    display: 'flex',
    gap: '0.3rem',
    marginTop: '0.2rem',
  },
  ratingBtn: {
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.2rem var(--space-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    minWidth: '32px',
    fontFamily: 'var(--font-ui)',
  },
  ratingBad: {
    background: 'var(--accent-red-muted)',
    color: 'var(--accent-red)',
  },
  ratingGood: {
    background: 'var(--accent-green-muted)',
    color: 'var(--accent-green)',
  },
  actions: {
    position: 'absolute',
    top: 'var(--space-sm)',
    right: 'var(--space-sm)',
    display: 'flex',
    gap: '0.2rem',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    padding: '0.1rem 0.25rem',
    lineHeight: 1,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
    textAlign: 'center',
    padding: 'var(--space-2xl)',
    fontFamily: 'var(--font-ui)',
  },
};

const se = {
  input: {
    flex: 1,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-ui)',
  },
  select: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-xs)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    padding: 'var(--space-xs) var(--space-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-ui)',
  },
  saveBtn: {
    background: 'var(--accent-blue-dim)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-blue)',
    padding: 'var(--space-xs) var(--space-md)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
};
