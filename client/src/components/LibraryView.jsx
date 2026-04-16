import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_) { return fallback; }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Generate a stable pastel-ish cover color from title string
function coverColor(title) {
  let hash = 0;
  for (let i = 0; i < (title || '').length; i++) hash = ((hash << 5) - hash) + title.charCodeAt(i);
  const hues = [210, 160, 30, 340, 270, 130, 10, 50, 190, 300];
  const hue = hues[Math.abs(hash) % hues.length];
  return `hsl(${hue}, 25%, 18%)`;
}

export default function LibraryView({ onSelectBook, onReview, onGraph, onVelocity, onAdmin, onSearch, onProjects, onVocab }) {
  const [books, setBooks]           = useState([]);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState(null);

  const [viewMode, setViewMode]   = useState(() => localStorage.getItem('lib_view') || 'grid');
  const [search, setSearch]       = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [sortBy, setSortBy]       = useState(() => localStorage.getItem('lib_sort') || 'date');

  const fileRef   = useRef();
  const isMobile  = useIsMobile();

  const loadBooks = () => {
    fetch('/api/books')
      .then(r => r.json())
      .then(data => setBooks(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load library'));
  };

  useEffect(() => { loadBooks(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append('epub', file);
    try {
      const r = await fetch('/api/books/upload', { method: 'POST', body: form });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Upload failed');
      loadBooks();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  };

  const handleDelete = async (id, title, e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/books/${id}`, { method: 'DELETE' });
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  const handleExport = async (book, e) => {
    e.stopPropagation();
    const r = await fetch(`/api/books/${book.id}/export`);
    const text = await r.text();
    const safe = (book.title || 'book').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadText(`${safe}_notes.md`, text);
  };

  const setView = (v) => { setViewMode(v); localStorage.setItem('lib_view', v); };
  const setSort = (v) => { setSortBy(v); localStorage.setItem('lib_sort', v); };

  const allTags = useMemo(() => {
    const counts = {};
    for (const b of books) {
      for (const t of safeParse(b.tags, [])) counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [books]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = books.filter(b => {
      if (q && !b.title?.toLowerCase().includes(q) && !b.author?.toLowerCase().includes(q)) return false;
      if (activeTag && !safeParse(b.tags, []).includes(activeTag)) return false;
      return true;
    });
    if (sortBy === 'title') result = [...result].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'author') result = [...result].sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    return result;
  }, [books, search, activeTag, sortBy]);

  return (
    <div style={s.container}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Library</h1>
          <span style={s.bookCount}>{books.length} book{books.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={s.headerRight}>
          {uploading && <span style={s.status}>Importing…</span>}
          {error && <span style={s.error}>{error}</span>}
          <button style={s.importBtn} onClick={() => fileRef.current.click()} disabled={uploading}>
            + Import EPUB
          </button>
          <input ref={fileRef} type="file" accept=".epub" style={{ display: 'none' }} onChange={handleUpload} />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        <input
          style={s.searchInput}
          placeholder="Filter by title or author…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.sortSelect} value={sortBy} onChange={e => setSort(e.target.value)}>
          <option value="date">Newest first</option>
          <option value="title">A → Z title</option>
          <option value="author">A → Z author</option>
        </select>
        <div style={s.viewToggle}>
          <button
            style={{ ...s.viewBtn, ...(viewMode === 'grid' ? s.viewBtnActive : {}) }}
            onClick={() => setView('grid')}
            title="Grid view"
          >▦</button>
          <button
            style={{ ...s.viewBtn, ...(viewMode === 'list' ? s.viewBtnActive : {}) }}
            onClick={() => setView('list')}
            title="List view"
          >☰</button>
        </div>
      </div>

      {/* ── Tag filter ── */}
      {allTags.length > 0 && (
        <div style={s.tagBar}>
          <button
            style={{ ...s.tagChip, ...(activeTag === null ? s.tagChipActive : {}) }}
            onClick={() => setActiveTag(null)}
          >All</button>
          {allTags.map(tag => (
            <button
              key={tag}
              style={{ ...s.tagChip, ...(activeTag === tag ? s.tagChipActive : {}) }}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >{tag}</button>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📖</div>
          <div style={s.emptyTitle}>
            {books.length === 0 ? 'Your library is empty' : 'No books match'}
          </div>
          <div style={s.emptyHint}>
            {books.length === 0
              ? 'Import an EPUB to start reading and building knowledge.'
              : 'Try a different filter or search term.'}
          </div>
          {books.length === 0 && (
            <button style={s.emptyBtn} onClick={() => fileRef.current.click()}>
              + Import your first EPUB
            </button>
          )}
        </div>
      )}

      {/* ── Grid view ── */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div style={{
          ...s.grid,
          gridTemplateColumns: isMobile
            ? 'repeat(auto-fill, minmax(150px, 1fr))'
            : 'repeat(auto-fill, minmax(180px, 1fr))',
        }}>
          {filtered.map(book => {
            const tags = safeParse(book.tags, []);
            const bg = coverColor(book.title);
            return (
              <div key={book.id} style={s.card} onClick={() => onSelectBook(book)}>
                <div style={{ ...s.cover, background: bg }}>
                  <div style={s.coverTitle}>{(book.title || 'U')[0]}</div>
                  {book.chapter_count > 0 && (
                    <div style={s.coverChapters}>{book.chapter_count} ch</div>
                  )}
                </div>
                <div style={s.cardBody}>
                  <div style={s.bookTitle} title={book.title}>{book.title || 'Untitled'}</div>
                  <div style={s.bookAuthor}>{book.author || 'Unknown author'}</div>
                  {tags.length > 0 && (
                    <div style={s.cardTags}>
                      {tags.slice(0, 3).map(t => <span key={t} style={s.cardTag}>{t}</span>)}
                      {tags.length > 3 && <span style={s.cardTag}>+{tags.length - 3}</span>}
                    </div>
                  )}
                </div>
                <div style={s.cardActions}>
                  <button style={s.actionBtn} onClick={e => handleExport(book, e)} title="Export notes">↓ md</button>
                  <button style={{ ...s.actionBtn, color: 'var(--accent-red)' }} onClick={e => handleDelete(book.id, book.title, e)} title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === 'list' && filtered.length > 0 && (
        <div style={s.listWrap}>
          {filtered.map(book => {
            const tags = safeParse(book.tags, []);
            const bg = coverColor(book.title);
            return (
              <div key={book.id} style={s.listRow} onClick={() => onSelectBook(book)}>
                <div style={{ ...s.listDot, background: bg }} />
                <div style={s.listInfo}>
                  <div style={s.listTitle}>{book.title || 'Untitled'}</div>
                  <div style={s.listMeta}>
                    {book.author || 'Unknown'} · {book.chapter_count} ch
                    {tags.length > 0 && (
                      <> · {tags.slice(0, 2).map(t => <span key={t} style={s.cardTag}>{t}</span>)}</>
                    )}
                  </div>
                </div>
                <div style={s.listActions}>
                  <button style={s.listActionBtn} onClick={e => handleExport(book, e)} title="Export">↓</button>
                  <button style={{ ...s.listActionBtn, color: 'var(--accent-red)' }} onClick={e => handleDelete(book.id, book.title, e)} title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  container: {
    flex: 1,
    background: 'var(--bg-base)',
    color: 'var(--text-primary)',
    overflow: 'auto',
    padding: 'var(--space-xl) var(--space-2xl)',
    paddingBottom: '4rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-xl)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--space-md)',
  },
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  bookCount: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  importBtn: {
    background: 'var(--accent-blue)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-sm) var(--space-lg)',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    whiteSpace: 'nowrap',
  },
  status: { color: 'var(--accent-blue)', fontSize: 'var(--text-sm)' },
  error:  { color: 'var(--accent-red)', fontSize: 'var(--text-sm)' },

  // Toolbar
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    marginBottom: 'var(--space-md)',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '160px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-sm) var(--space-md)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
  },
  sortSelect: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-sm) var(--space-sm)',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  viewToggle: {
    display: 'flex',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  viewBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    padding: 'var(--space-sm) var(--space-md)',
    fontSize: 'var(--text-md)',
    lineHeight: 1,
    fontFamily: 'var(--font-ui)',
  },
  viewBtnActive: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },

  // Tags
  tagBar: {
    display: 'flex',
    gap: 'var(--space-xs)',
    flexWrap: 'wrap',
    marginBottom: 'var(--space-xl)',
  },
  tagChip: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-pill)',
    color: 'var(--text-muted)',
    padding: 'var(--space-xs) var(--space-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    fontFamily: 'var(--font-ui)',
  },
  tagChipActive: {
    background: 'var(--accent-blue-muted)',
    border: '1px solid var(--accent-blue)',
    color: 'var(--accent-blue)',
  },

  // Grid
  grid: {
    display: 'grid',
    gap: 'var(--space-lg)',
  },
  card: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color var(--transition), box-shadow var(--transition)',
  },
  cover: {
    height: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  coverTitle: {
    fontSize: '3rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.15)',
    fontFamily: 'var(--font-reading)',
    userSelect: 'none',
  },
  coverChapters: {
    position: 'absolute',
    bottom: '6px',
    right: '8px',
    fontSize: 'var(--text-xs)',
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 500,
  },
  cardBody: {
    padding: 'var(--space-md)',
    flex: 1,
  },
  bookTitle: {
    fontWeight: 600,
    fontSize: 'var(--text-base)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  bookAuthor: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: 'var(--space-sm)',
  },
  cardTag: {
    fontSize: 'var(--text-xs)',
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 6px',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    borderTop: '1px solid var(--border-subtle)',
    padding: 'var(--space-xs) var(--space-sm)',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
    padding: '2px 6px',
    fontFamily: 'var(--font-ui)',
  },

  // List
  listWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-md) var(--space-lg)',
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
  },
  listDot: {
    width: '8px',
    height: '36px',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
  },
  listInfo: { flex: 1, minWidth: 0 },
  listTitle: {
    fontWeight: 600,
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listMeta: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    marginTop: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs)',
    flexWrap: 'wrap',
  },
  listActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  listActionBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    padding: 'var(--space-xs) var(--space-sm)',
    fontSize: 'var(--text-sm)',
    minWidth: '32px',
    minHeight: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-ui)',
  },

  // Empty state
  empty: {
    textAlign: 'center',
    marginTop: '8vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  emptyIcon: {
    fontSize: '3rem',
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: 'var(--text-lg)',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  emptyHint: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    maxWidth: '320px',
    lineHeight: 1.5,
  },
  emptyBtn: {
    marginTop: 'var(--space-sm)',
    background: 'var(--accent-blue)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-sm) var(--space-xl)',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
};
