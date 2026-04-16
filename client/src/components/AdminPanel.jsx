import React, { useState, useEffect, useCallback } from 'react';

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_) { return fallback; }
}

const STATUS_COLORS = {
  active:  { border: 'var(--border)', badge: null },
  leech:   { border: 'var(--accent-red)', badge: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)', label: '⚠ leech' } },
  retired: { border: 'var(--accent-blue)', badge: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', label: '🏆 retired' } },
};

export default function AdminPanel({ onBack }) {
  const [tab, setTab] = useState('cards'); // 'cards' | 'books'

  // ── Cards tab state ──────────────────────────────────────────────────────────
  const [cards, setCards]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBook, setFilterBook]     = useState('all');

  const [bulkAction, setBulkAction] = useState('');
  const [bulkTag, setBulkTag]       = useState('');
  const [bulkStatus, setBulkStatus] = useState('active');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkMsg, setBulkMsg]       = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/concept_cards')
      .then(r => r.json())
      .then(data => setCards(Array.isArray(data) ? data : []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derived: unique books for filter dropdown
  const books = [...new Set(cards.map(c => c.source_book))].sort();

  // Filtered list
  const filtered = cards.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterBook !== 'all' && c.source_book !== filterBook) return false;
    if (search) {
      const q = search.toLowerCase();
      const tags = safeParse(c.tags, []).join(' ').toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !tags.includes(q)) return false;
    }
    return true;
  });

  const allChecked = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.delete(c.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.add(c.id)); return s; });
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectedIds = [...selected];
  const selectionCount = selectedIds.length;

  const runBulk = async () => {
    if (!bulkAction || selectionCount === 0) return;
    if (bulkAction === 'delete' && !window.confirm(`Delete ${selectionCount} card(s)? This cannot be undone.`)) return;

    const payload =
      bulkAction === 'set_status'  ? { status: bulkStatus } :
      bulkAction === 'add_tag'     ? { tag: bulkTag } :
      bulkAction === 'remove_tag'  ? { tag: bulkTag } :
      undefined;

    setBulkWorking(true);
    setBulkMsg(null);
    try {
      const r = await fetch('/api/concept_cards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: bulkAction, ids: selectedIds, payload }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Bulk action failed');
      setBulkMsg(`Done — ${data.affected} card(s) affected.`);
      setSelected(new Set());
      load();
    } catch (err) {
      setBulkMsg(`Error: ${err.message}`);
    } finally {
      setBulkWorking(false);
    }
  };

  return (
    <div style={s.page}>
      {/* Header + tabs */}
      <div style={s.headerArea}>
        <h1 style={s.header}>Admin</h1>
        <div style={s.tabs}>
          <button style={{ ...s.tabBtn, ...(tab === 'cards' ? s.tabBtnActive : {}) }} onClick={() => setTab('cards')}>Cards</button>
          <button style={{ ...s.tabBtn, ...(tab === 'books' ? s.tabBtnActive : {}) }} onClick={() => setTab('books')}>Books</button>
        </div>
        <span style={s.countBadge}>{tab === 'cards' ? `${cards.length} cards` : ''}</span>
      </div>

      {tab === 'cards' && <div style={s.filterBar}>
        <input
          style={s.searchInput}
          placeholder="Search title or tag…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="leech">Leech</option>
          <option value="retired">Retired</option>
        </select>
        <select style={s.select} value={filterBook} onChange={e => setFilterBook(e.target.value)}>
          <option value="all">All books</option>
          {books.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <span style={s.filteredCount}>{filtered.length} shown</span>
      </div>}

      {tab === 'cards' && <div style={s.bulkBar}>
        <span style={{ fontSize: 'var(--text-sm)', color: selectionCount > 0 ? 'var(--text-primary)' : 'var(--text-faint)', minWidth: '90px', fontFamily: 'var(--font-ui)' }}>
          {selectionCount > 0 ? `${selectionCount} selected` : 'Select cards'}
        </span>
        <select
          style={{ ...s.select, opacity: selectionCount > 0 ? 1 : 0.4 }}
          value={bulkAction}
          onChange={e => { setBulkAction(e.target.value); setBulkMsg(null); }}
          disabled={selectionCount === 0}
        >
          <option value="">— Bulk action —</option>
          <option value="delete">Delete</option>
          <option value="reset_srs">Reset SRS</option>
          <option value="set_status">Set status…</option>
          <option value="add_tag">Add tag…</option>
          <option value="remove_tag">Remove tag…</option>
        </select>

        {bulkAction === 'set_status' && (
          <select style={s.select} value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="leech">Leech</option>
            <option value="retired">Retired</option>
          </select>
        )}
        {(bulkAction === 'add_tag' || bulkAction === 'remove_tag') && (
          <input
            style={{ ...s.searchInput, maxWidth: '160px' }}
            placeholder="Tag name"
            value={bulkTag}
            onChange={e => setBulkTag(e.target.value)}
          />
        )}

        <button
          style={{ ...s.applyBtn, opacity: (selectionCount > 0 && bulkAction) ? 1 : 0.4 }}
          disabled={selectionCount === 0 || !bulkAction || bulkWorking}
          onClick={runBulk}
        >
          {bulkWorking ? 'Working…' : 'Apply'}
        </button>

        {bulkMsg && (
          <span style={{ fontSize: 'var(--text-xs)', color: bulkMsg.startsWith('Error') ? 'var(--accent-red)' : 'var(--accent-green)', fontFamily: 'var(--font-ui)' }}>
            {bulkMsg}
          </span>
        )}
      </div>}

      {/* Books tab */}
      {tab === 'books' && <BooksTab />}

      {/* Cards table */}
      {tab === 'cards' && (loading ? (
        <div style={s.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No cards match the current filters.</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={{ ...s.th, width: '28px' }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th style={s.th}>Title</th>
                <th style={s.th}>Book</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Tags</th>
                <th style={s.th}>Interval</th>
                <th style={s.th}>EF</th>
                <th style={s.th}>Due</th>
                <th style={s.th}>Reviews</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(card => (
                <AdminRow
                  key={card.id}
                  card={card}
                  checked={selected.has(card.id)}
                  onToggle={() => toggleOne(card.id)}
                  onDelete={() => {
                    setSelected(prev => { const s = new Set(prev); s.delete(card.id); return s; });
                    setCards(prev => prev.filter(c => c.id !== card.id));
                  }}
                  onUpdate={updated => setCards(prev => prev.map(c => c.id === updated.id ? updated : c))}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function AdminRow({ card, checked, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing]   = useState(false);
  const [title, setTitle]       = useState(card.title);
  const [body, setBody]         = useState(card.body);
  const [tagsInput, setTagsInput] = useState(safeParse(card.tags, []).join(', '));
  const [saving, setSaving]     = useState(false);

  const tagsArr = safeParse(card.tags, []);
  const today = new Date().toISOString().slice(0, 10);
  const isDue = card.srs_due <= today;
  const statusInfo = STATUS_COLORS[card.status] || STATUS_COLORS.active;

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${card.title}"?`)) return;
    await fetch(`/api/concept_cards/${card.id}`, { method: 'DELETE' });
    onDelete();
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
      <tr style={{ background: 'var(--accent-green-dim)' }}>
        <td colSpan={10} style={{ padding: 'var(--space-sm) var(--space-lg)' }}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <input style={s.editInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" required />
            <textarea style={{ ...s.editInput, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              value={body} onChange={e => setBody(e.target.value)} required />
            <input style={s.editInput} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="Tags (comma-separated)" />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button type="button" style={s.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" style={s.saveBtn} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ ...s.row, borderLeft: `3px solid ${statusInfo.border}` }}>
      <td style={s.td}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </td>
      <td style={{ ...s.td, maxWidth: '240px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={s.rowTitle} title={card.title}>{card.title}</span>
          {statusInfo.badge && (
            <span style={{ ...s.badge, background: statusInfo.badge.bg, color: statusInfo.badge.color }}>
              {statusInfo.badge.label}
            </span>
          )}
        </div>
      </td>
      <td style={{ ...s.td, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', maxWidth: '160px' }}>
        <span title={card.source_book}>{card.source_book}</span>
        <span style={{ color: 'var(--text-faint)' }}> p.{card.source_page}</span>
      </td>
      <td style={s.td}>
        <span style={{ fontSize: 'var(--text-xs)', color: statusInfo.badge?.color || 'var(--text-muted)' }}>
          {card.status || 'active'}
        </span>
      </td>
      <td style={s.td}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
          {tagsArr.map(t => <span key={t} style={s.tag}>{t}</span>)}
        </div>
      </td>
      <td style={{ ...s.td, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'right' }}>
        {card.srs_interval}d
      </td>
      <td style={{ ...s.td, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'right' }}>
        {(card.srs_efactor || 0).toFixed(1)}
      </td>
      <td style={{ ...s.td, fontSize: 'var(--text-xs)', textAlign: 'right', color: isDue ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: isDue ? 600 : 400 }}>
        {isDue ? 'Due' : card.srs_due}
      </td>
      <td style={{ ...s.td, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'right' }}>
        {card.review_count || 0}
      </td>
      <td style={{ ...s.td, textAlign: 'right' }}>
        <button style={s.iconBtn} onClick={() => setEditing(true)} title="Edit">✎</button>
        <button style={{ ...s.iconBtn, color: 'var(--accent-red)' }} onClick={handleDelete} title="Delete">✕</button>
      </td>
    </tr>
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
  headerArea: {
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
  },
  countBadge: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    marginLeft: 'auto',
    fontFamily: 'var(--font-ui)',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  },
  bulkBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  searchInput: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
    flex: 1,
    minWidth: '160px',
    maxWidth: '280px',
    fontFamily: 'var(--font-ui)',
  },
  select: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  filteredCount: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    marginLeft: 'auto',
    fontFamily: 'var(--font-ui)',
  },
  applyBtn: {
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-green)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-md)',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  thead: {
    background: 'var(--bg-elevated)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  th: {
    padding: 'var(--space-sm) var(--space-md)',
    textAlign: 'left',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    borderBottom: '1px solid var(--border-subtle)',
    whiteSpace: 'nowrap',
  },
  row: {
    borderBottom: '1px solid var(--border-subtle)',
    borderLeft: '3px solid var(--border)',
  },
  td: {
    padding: 'var(--space-sm) var(--space-md)',
    verticalAlign: 'middle',
  },
  rowTitle: {
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
    display: 'block',
  },
  badge: {
    fontSize: '0.62rem',
    borderRadius: 'var(--radius-sm)',
    padding: '0.05rem 0.3rem',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  tag: {
    fontSize: '0.65rem',
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem 0.3rem',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    padding: '0.1rem 0.3rem',
    lineHeight: 1,
  },
  editInput: {
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
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  tabs: {
    display: 'flex',
    gap: 'var(--space-xs)',
  },
  tabBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    padding: 'var(--space-xs) var(--space-md)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    fontFamily: 'var(--font-ui)',
  },
  tabBtnActive: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--accent-blue)',
    color: 'var(--accent-blue)',
  },
};

// ── Books Tab ──────────────────────────────────────────────────────────────────

function BooksTab() {
  const [books, setBooks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [allTags, setAllTags]   = useState([]); // [{tag, count}]
  const [newTagInput, setNewTagInput] = useState(''); // for global tag creation

  const load = () => {
    fetch('/api/books')
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setBooks(arr);
        // Build global tag frequency
        const counts = {};
        for (const b of arr) {
          for (const t of safeParse(b.tags, [])) counts[t] = (counts[t] || 0) + 1;
        }
        setAllTags(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })));
      })
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTags = async (bookId, tags) => {
    const r = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    const updated = await r.json();
    setBooks(prev => prev.map(b => b.id === bookId ? updated : b));
    // Rebuild tag list
    const allBooks = books.map(b => b.id === bookId ? updated : b);
    const counts = {};
    for (const b of allBooks) {
      for (const t of safeParse(b.tags, [])) counts[t] = (counts[t] || 0) + 1;
    }
    setAllTags(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })));
  };

  const filtered = books.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tag overview */}
      {allTags.length > 0 && (
        <div style={bt.tagOverview}>
          <span style={bt.overviewLabel}>All tags:</span>
          {allTags.map(({ tag, count }) => (
            <span key={tag} style={bt.tagPill}>{tag} <span style={{ color: 'var(--text-faint)' }}>{count}</span></span>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div style={bt.bar}>
        <input
          style={bt.input}
          placeholder="Search books…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', fontFamily: 'var(--font-ui)' }}>{filtered.length} books</span>
      </div>

      {/* Book list */}
      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : (
        <div style={bt.list}>
          {filtered.map(book => (
            <BookTagRow key={book.id} book={book} onUpdate={tags => updateTags(book.id, tags)} allTags={allTags.map(t => t.tag)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookTagRow({ book, onUpdate, allTags }) {
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tags = safeParse(book.tags, []);

  const suggestions = allTags.filter(t => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()) && tagInput.trim().length > 0);

  const addTag = (tag) => {
    const t = tag.trim();
    if (!t || tags.includes(t)) return;
    onUpdate([...tags, t]);
    setTagInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag) => onUpdate(tags.filter(t => t !== tag));

  return (
    <div style={bt.row}>
      <div style={bt.bookInfo}>
        <div style={bt.bookTitle}>{book.title || 'Untitled'}</div>
        <div style={bt.bookAuthor}>{book.author || 'Unknown author'} · {book.chapter_count} chapters</div>
      </div>
      <div style={bt.tagArea}>
        {/* Existing tags */}
        {tags.map(t => (
          <span key={t} style={bt.tag}>
            {t}
            <button style={bt.tagRemove} onClick={() => removeTag(t)} title={`Remove "${t}"`}>×</button>
          </span>
        ))}
        {/* Add tag input */}
        <div style={{ position: 'relative' }}>
          <input
            style={bt.tagInput}
            placeholder="+ add tag"
            value={tagInput}
            onChange={e => { setTagInput(e.target.value); setShowSuggestions(true); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
              if (e.key === 'Escape') { setTagInput(''); setShowSuggestions(false); }
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={bt.suggestions}>
              {suggestions.map(s => (
                <div key={s} style={bt.suggestion} onMouseDown={() => addTag(s)}>{s}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const bt = {
  tagOverview: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    padding: 'var(--space-sm) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    alignItems: 'center',
    flexShrink: 0,
  },
  overviewLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginRight: 'var(--space-xs)',
    fontFamily: 'var(--font-ui)',
  },
  tagPill: {
    fontSize: 'var(--text-xs)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-pill)',
    padding: '0.15rem var(--space-sm)',
    fontFamily: 'var(--font-ui)',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-lg)',
    padding: 'var(--space-sm) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  bookInfo: {
    width: '240px',
    flexShrink: 0,
  },
  bookTitle: {
    fontWeight: 600,
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-ui)',
  },
  bookAuthor: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    marginTop: '0.1rem',
    fontFamily: 'var(--font-ui)',
  },
  tagArea: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    fontSize: 'var(--text-xs)',
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green-muted)',
    color: 'var(--accent-green)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.15rem var(--space-xs)',
    fontFamily: 'var(--font-ui)',
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-green-muted)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    padding: 0,
    lineHeight: 1,
  },
  tagInput: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-xs)',
    padding: '0.2rem var(--space-sm)',
    outline: 'none',
    width: '90px',
    fontFamily: 'var(--font-ui)',
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    zIndex: 10,
    minWidth: '120px',
    maxHeight: '140px',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-md)',
  },
  suggestion: {
    padding: 'var(--space-xs) var(--space-sm)',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
};
