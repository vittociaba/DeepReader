import React, { useState, useRef, useEffect } from 'react';

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_) { return fallback; }
}

const TYPE_COLOR = { N: 'var(--accent-blue)', Q: 'var(--accent-amber)', C: 'var(--accent-green)' };
const TYPE_LABEL = { N: 'Note', Q: 'Question', C: 'Concept' };

export default function SearchView({ onBack, onOpenBook }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = async (q) => {
    if (q.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    if (q.trim().length >= 2) search(q);
    else setResults(null);
  };

  const total = results ? results.annotations.length + results.cards.length + results.vocab.length : 0;

  return (
    <div style={s.page}>
      <h1 style={s.header}>Search</h1>

      <div style={s.searchBar}>
        <input
          ref={inputRef}
          style={s.input}
          placeholder="Search across all annotations, cards, and vocabulary…"
          value={query}
          onChange={handleChange}
        />
        {loading && <span style={s.hint}>Searching…</span>}
        {results && !loading && <span style={s.hint}>{total} result{total !== 1 ? 's' : ''}</span>}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {!results && !loading && (
        <div style={s.empty}>Type at least 2 characters to search across all books, cards, and vocabulary.</div>
      )}

      {results && (
        <div style={s.results}>
          {/* Annotations */}
          {results.annotations.length > 0 && (
            <section style={s.section}>
              <div style={s.sectionTitle}>Annotations ({results.annotations.length})</div>
              {results.annotations.map(ann => (
                <div
                  key={ann.id}
                  style={{ ...s.card, borderLeftColor: TYPE_COLOR[ann.type] || 'var(--text-muted)', cursor: onOpenBook ? 'pointer' : 'default' }}
                  onClick={() => onOpenBook && onOpenBook(ann.book_id, ann.chapter_index, ann.page_index)}
                >
                  <div style={s.cardHeader}>
                    <span style={{ ...s.badge, background: TYPE_COLOR[ann.type] ? `color-mix(in srgb, ${TYPE_COLOR[ann.type]} 12%, transparent)` : 'var(--bg-hover)', color: TYPE_COLOR[ann.type] }}>
                      {TYPE_LABEL[ann.type] || ann.type}
                    </span>
                    <span style={s.cardMeta}>{ann.book_title} · Ch {ann.chapter_index + 1} p{ann.page_index + 1}</span>
                  </div>
                  <div style={s.cardBody}>{ann.body || <em style={{ color: 'var(--text-muted)' }}>No note text</em>}</div>
                </div>
              ))}
            </section>
          )}

          {/* Concept cards */}
          {results.cards.length > 0 && (
            <section style={s.section}>
              <div style={s.sectionTitle}>Concept Cards ({results.cards.length})</div>
              {results.cards.map(card => {
                const tags = safeParse(card.tags, []);
                return (
                  <div key={card.id} style={{ ...s.card, borderLeftColor: 'var(--accent-green)' }}>
                    <div style={s.cardHeader}>
                      <span style={s.cardTitle}>{card.title}</span>
                      {card.status === 'leech'   && <span style={{ ...s.badge, background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>⚠ leech</span>}
                      {card.status === 'retired' && <span style={{ ...s.badge, background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>🏆 retired</span>}
                    </div>
                    <div style={s.cardMeta}>{card.source_book} · {card.source_page}</div>
                    {tags.length > 0 && (
                      <div style={s.tags}>{tags.map(t => <span key={t} style={s.tag}>{t}</span>)}</div>
                    )}
                    <div style={{ ...s.cardBody, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '0.3rem' }}>
                      {card.body.slice(0, 120)}{card.body.length > 120 ? '…' : ''}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Vocab */}
          {results.vocab.length > 0 && (
            <section style={s.section}>
              <div style={s.sectionTitle}>Vocabulary ({results.vocab.length})</div>
              {results.vocab.map(v => (
                <div key={v.id} style={{ ...s.card, borderLeftColor: 'var(--accent-amber)' }}>
                  <div style={s.cardHeader}>
                    <span style={s.cardTitle}>{v.word}</span>
                    <span style={{ ...s.badge, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                      {v.language === 'it' ? '🇮🇹' : '🇬🇧'} {v.language.toUpperCase()}
                    </span>
                  </div>
                  {v.translation && <div style={{ color: 'var(--accent-amber)', fontSize: 'var(--text-sm)' }}>{v.translation}</div>}
                  {v.context && <div style={{ ...s.cardBody, color: 'var(--text-muted)', fontStyle: 'italic' }}>{v.context}</div>}
                </div>
              ))}
            </section>
          )}

          {total === 0 && (
            <div style={s.empty}>No results for "{query}"</div>
          )}
        </div>
      )}
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
  header: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.02em',
    padding: 'var(--space-xl) var(--space-2xl) 0',
    fontFamily: 'var(--font-ui)',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-md) var(--space-2xl)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-sm) var(--space-md)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
  },
  hint: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-ui)',
  },
  error: {
    padding: 'var(--space-md) var(--space-2xl)',
    color: 'var(--accent-red)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-md) var(--space-2xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xl)',
  },
  section: {},
  sectionTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 'var(--space-sm)',
    fontFamily: 'var(--font-ui)',
  },
  card: {
    background: 'var(--bg-surface)',
    borderLeft: '3px solid',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
    padding: 'var(--space-sm) var(--space-md)',
    marginBottom: 'var(--space-xs)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
  },
  cardMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-ui)',
  },
  cardBody: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  badge: {
    fontSize: '0.65rem',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem 0.35rem',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-xs)',
  },
  tag: {
    fontSize: '0.65rem',
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem 0.3rem',
    fontFamily: 'var(--font-ui)',
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
