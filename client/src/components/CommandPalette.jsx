import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * CommandPalette — Ctrl+K quick navigation and search.
 * Props:
 *   open       — boolean
 *   onClose    — close callback
 *   onNavigate — (viewId) => void
 *   onSelectBook — (book) => void
 *   books      — array of book objects
 *   dueCount   — number of due cards
 */
export default function CommandPalette({ open, onClose, onNavigate, onSelectBook, books, dueCount }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef();
  const listRef = useRef();

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const commands = useMemo(() => {
    const items = [
      { id: 'library',  label: 'Go to Library',    type: 'nav', icon: '◫' },
      { id: 'review',   label: `Review Cards${dueCount ? ` (${dueCount} due)` : ''}`, type: 'nav', icon: '▣' },
      { id: 'search',   label: 'Full-text Search', type: 'nav', icon: '⌕' },
      { id: 'graph',    label: 'Concept Graph',    type: 'nav', icon: '◎' },
      { id: 'velocity', label: 'Velocity Dashboard', type: 'nav', icon: '▤' },
      { id: 'projects', label: 'Reading Lists',    type: 'nav', icon: '▧' },
      { id: 'vocab',    label: 'Vocabulary',        type: 'nav', icon: '▥' },
      { id: 'admin',    label: 'Settings & Admin',  type: 'nav', icon: '⚙' },
    ];

    // Add books as "Open <title>" commands
    if (books) {
      for (const book of books) {
        items.push({
          id: `book:${book.id}`,
          label: book.title || 'Untitled',
          sublabel: book.author,
          type: 'book',
          icon: '📖',
          book,
        });
      }
    }

    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.sublabel && item.sublabel.toLowerCase().includes(q))
    );
  }, [query, books, dueCount]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const execute = (item) => {
    if (item.type === 'nav') {
      onNavigate(item.id);
    } else if (item.type === 'book' && item.book) {
      onSelectBook(item.book);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, commands.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && commands[selectedIndex]) {
      execute(commands[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.palette} onClick={e => e.stopPropagation()}>
        <div style={s.inputRow}>
          <span style={s.searchIcon}>⌕</span>
          <input
            ref={inputRef}
            style={s.input}
            placeholder="Search books, navigate views…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd style={s.escKey}>esc</kbd>
        </div>

        <div style={s.list} ref={listRef}>
          {commands.length === 0 && (
            <div style={s.empty}>No results for "{query}"</div>
          )}
          {commands.map((item, i) => (
            <button
              key={item.id}
              style={{
                ...s.item,
                ...(i === selectedIndex ? s.itemSelected : {}),
              }}
              onClick={() => execute(item)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span style={s.itemIcon}>{item.icon}</span>
              <div style={s.itemText}>
                <span style={s.itemLabel}>{item.label}</span>
                {item.sublabel && <span style={s.itemSub}>{item.sublabel}</span>}
              </div>
              <span style={s.itemType}>
                {item.type === 'nav' ? 'Navigate' : 'Open book'}
              </span>
            </button>
          ))}
        </div>

        <div style={s.footer}>
          <span style={s.footerHint}>
            <kbd style={s.key}>↑↓</kbd> navigate
            <kbd style={s.key}>↵</kbd> select
            <kbd style={s.key}>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    zIndex: 1000,
  },
  palette: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    width: '100%',
    maxWidth: '560px',
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: 'var(--space-md) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  searchIcon: {
    fontSize: '1.1rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-md)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
  },
  escKey: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 6px',
    fontFamily: 'var(--font-ui)',
  },
  list: {
    maxHeight: '360px',
    overflowY: 'auto',
    padding: 'var(--space-xs) 0',
  },
  empty: {
    padding: 'var(--space-xl)',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 'var(--text-sm)',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    width: '100%',
    padding: 'var(--space-sm) var(--space-lg)',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-sm)',
    textAlign: 'left',
    fontFamily: 'var(--font-ui)',
  },
  itemSelected: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },
  itemIcon: {
    width: '24px',
    textAlign: 'center',
    fontSize: '1rem',
    flexShrink: 0,
    opacity: 0.7,
  },
  itemText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: 0,
  },
  itemLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemSub: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemType: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    flexShrink: 0,
  },
  footer: {
    borderTop: '1px solid var(--border-subtle)',
    padding: 'var(--space-sm) var(--space-lg)',
    display: 'flex',
    justifyContent: 'center',
  },
  footerHint: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    display: 'flex',
    gap: 'var(--space-md)',
    alignItems: 'center',
  },
  key: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 4px',
    marginRight: '3px',
    fontFamily: 'var(--font-ui)',
  },
};
