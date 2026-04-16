import React, { useState, useEffect } from 'react';

const COLORS = ['var(--accent-blue)', 'var(--accent-green)', 'var(--accent-amber)', '#ff6b9a', 'var(--accent-purple)', '#fb923c'];

export default function ProjectsView({ onBack }) {
  const [projects, setProjects] = useState([]);
  const [books, setBooks]       = useState([]);
  const [expanded, setExpanded] = useState(null); // project id
  const [projectBooks, setProjectBooks] = useState({}); // id -> [books]
  const [projectConcepts, setProjectConcepts] = useState({}); // id -> { tags, cards }

  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [addBookId, setAddBookId] = useState('');

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
    fetch('/api/books').then(r => r.json()).then(setBooks).catch(() => {});
  }, []);

  const createProject = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    const p = await r.json();
    setProjects(prev => [...prev, p]);
    setNewName('');
    setCreating(false);
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Delete this project? Books are not deleted.')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const expandProject = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!projectBooks[id]) {
      const [booksRes, conceptsRes] = await Promise.all([
        fetch(`/api/projects/${id}/books`).then(r => r.json()),
        fetch(`/api/projects/${id}/concepts`).then(r => r.json()),
      ]);
      setProjectBooks(prev => ({ ...prev, [id]: booksRes }));
      setProjectConcepts(prev => ({ ...prev, [id]: conceptsRes }));
    }
  };

  const addBook = async (projectId) => {
    if (!addBookId) return;
    await fetch(`/api/projects/${projectId}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: addBookId }),
    });
    setAddBookId('');
    // Refresh project books
    const updated = await fetch(`/api/projects/${projectId}/books`).then(r => r.json());
    setProjectBooks(prev => ({ ...prev, [projectId]: updated }));
    const concepts = await fetch(`/api/projects/${projectId}/concepts`).then(r => r.json());
    setProjectConcepts(prev => ({ ...prev, [projectId]: concepts }));
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, book_count: (p.book_count || 0) + 1 } : p));
  };

  const removeBook = async (projectId, bookId) => {
    await fetch(`/api/projects/${projectId}/books/${bookId}`, { method: 'DELETE' });
    setProjectBooks(prev => ({ ...prev, [projectId]: (prev[projectId] || []).filter(b => b.id !== bookId) }));
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, book_count: Math.max(0, (p.book_count || 1) - 1) } : p));
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Reading Lists</h1>
        <button style={s.createBtn} onClick={() => setCreating(v => !v)}>
          {creating ? 'Cancel' : '+ New List'}
        </button>
      </header>

      {creating && (
        <form onSubmit={createProject} style={s.createForm}>
          <input
            style={s.input}
            placeholder="List name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            required
          />
          <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                style={{ ...s.colorDot, background: c, outline: newColor === c ? '2px solid var(--text-primary)' : 'none' }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button type="submit" style={s.saveBtn}>Create</button>
        </form>
      )}

      {projects.length === 0 && !creating ? (
        <div style={s.empty}>No reading lists yet. Create one to group books by theme or project.</div>
      ) : (
        <div style={s.list}>
          {projects.map(p => {
            const isOpen = expanded === p.id;
            const pBooks = projectBooks[p.id] || [];
            const pConcepts = projectConcepts[p.id] || { tags: [], cards: [] };
            const availableBooks = books.filter(b => !pBooks.find(pb => pb.id === b.id));

            return (
              <div key={p.id} style={{ ...s.projectCard, borderLeftColor: p.color }}>
                <div style={s.projectHeader} onClick={() => expandProject(p.id)}>
                  <span style={{ ...s.colorDot, background: p.color, cursor: 'default' }} />
                  <span style={s.projectName}>{p.name}</span>
                  <span style={s.bookCount}>{p.book_count || 0} book{p.book_count !== 1 ? 's' : ''}</span>
                  <span style={s.chevron}>{isOpen ? '▲' : '▼'}</span>
                  <button
                    style={s.deleteBtn}
                    onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                    title="Delete list"
                  >✕</button>
                </div>

                {isOpen && (
                  <div style={s.projectBody}>
                    {/* Add book */}
                    <div style={s.addRow}>
                      <select
                        style={s.select}
                        value={addBookId}
                        onChange={e => setAddBookId(e.target.value)}
                      >
                        <option value="">Add a book…</option>
                        {availableBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                      </select>
                      <button
                        style={s.addBtn}
                        onClick={() => addBook(p.id)}
                        disabled={!addBookId}
                      >Add</button>
                    </div>

                    {/* Book list */}
                    {pBooks.length === 0 ? (
                      <div style={s.subEmpty}>No books in this list yet.</div>
                    ) : (
                      <div style={s.bookList}>
                        {pBooks.map(b => (
                          <div key={b.id} style={s.bookRow}>
                            <span style={s.bookTitle}>{b.title}</span>
                            <button
                              style={s.removeBtn}
                              onClick={() => removeBook(p.id, b.id)}
                              title="Remove from list"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Shared concepts */}
                    {pConcepts.tags.length > 0 && (
                      <div style={s.conceptSection}>
                        <div style={s.conceptTitle}>Shared Concepts</div>
                        <div style={s.tagCloud}>
                          {pConcepts.tags.slice(0, 20).map(({ tag, count }) => (
                            <span key={tag} style={{
                              ...s.tagChip,
                              fontSize: Math.max(0.65, Math.min(1.0, 0.65 + count * 0.05)) + 'rem',
                            }}>
                              {tag} <span style={{ color: 'var(--text-faint)' }}>{count}</span>
                            </span>
                          ))}
                        </div>
                        <div style={s.conceptSubtitle}>{pConcepts.cards.length} concept cards across these books</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
  createBtn: {
    background: 'none',
    border: '1px solid var(--text-faint)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    padding: 'var(--space-xs) var(--space-md)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  createForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-md) var(--space-2xl)',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-elevated)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    minWidth: '160px',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
  },
  colorDot: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  saveBtn: {
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-green)',
    padding: 'var(--space-xs) var(--space-md)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-md) var(--space-2xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  projectCard: {
    background: 'var(--bg-surface)',
    borderLeft: '3px solid',
    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
  },
  projectHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: 'var(--space-md) var(--space-lg)',
    cursor: 'pointer',
  },
  projectName: {
    flex: 1,
    fontWeight: 600,
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
  },
  bookCount: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
  },
  chevron: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    padding: '0.1rem 0.3rem',
    fontFamily: 'var(--font-ui)',
  },
  projectBody: {
    borderTop: '1px solid var(--border-subtle)',
    padding: 'var(--space-md) var(--space-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  addRow: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'center',
  },
  select: {
    flex: 1,
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
  },
  addBtn: {
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-green)',
    padding: 'var(--space-xs) var(--space-md)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  bookList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  bookRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: 'var(--space-xs) 0',
  },
  bookTitle: {
    flex: 1,
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    padding: '0.1rem 0.3rem',
    fontFamily: 'var(--font-ui)',
  },
  conceptSection: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: 'var(--space-sm)',
    marginTop: 'var(--space-xs)',
  },
  conceptTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 'var(--space-xs)',
  },
  tagCloud: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-xs)',
  },
  tagChip: {
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.15rem var(--space-xs)',
  },
  conceptSubtitle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    marginTop: 'var(--space-sm)',
  },
  subEmpty: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-faint)',
    fontStyle: 'italic',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-base)',
    textAlign: 'center',
    padding: 'var(--space-2xl)',
  },
};
