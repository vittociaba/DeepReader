import React, { useEffect, useRef } from 'react';

const TYPE_META = {
  N: { label: 'Note',     color: 'var(--accent-blue)',  bg: 'var(--accent-blue-muted)' },
  Q: { label: 'Question', color: 'var(--accent-amber)', bg: 'var(--accent-amber-muted)' },
  C: { label: 'Concept',  color: 'var(--accent-green)', bg: 'var(--accent-green-muted)' },
};

function AnnotationCard({ annotation, isActive, onBodyBlur, onDelete, cardRef }) {
  const textareaRef = useRef();
  const meta = TYPE_META[annotation.type] || TYPE_META.N;

  useEffect(() => {
    if (isActive && textareaRef.current) textareaRef.current.focus();
  }, [isActive]);

  const handleBlur = () => {
    onBodyBlur(annotation.id, textareaRef.current?.value ?? annotation.body);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const { selectionStart, selectionEnd, value } = ta;
      if (selectionStart === selectionEnd) return;
      const selected = value.slice(selectionStart, selectionEnd);
      const cloze = `{{c1::${selected}}}`;
      const newValue = value.slice(0, selectionStart) + cloze + value.slice(selectionEnd);
      ta.value = newValue;
      const newPos = selectionStart + cloze.length;
      ta.setSelectionRange(newPos, newPos);
      onBodyBlur(annotation.id, newValue);
    }
  };

  return (
    <div
      ref={cardRef}
      style={{
        ...s.card,
        borderLeftColor: meta.color,
        background: isActive ? 'var(--bg-hover)' : 'var(--bg-elevated)',
      }}
    >
      <div style={s.cardHeader}>
        <span style={{ ...s.typeBadge, color: meta.color, background: meta.bg }}>
          {meta.label}
        </span>
        <button style={s.deleteBtn} onClick={() => onDelete(annotation.id)} title="Delete">✕</button>
      </div>
      <div style={s.excerpt} title={annotation.selected_text}>
        "{annotation.selected_text.length > 80
          ? annotation.selected_text.slice(0, 80) + '…'
          : annotation.selected_text}"
      </div>
      <textarea
        ref={textareaRef}
        style={s.textarea}
        defaultValue={annotation.body}
        placeholder="Add a note… (Ctrl+H to cloze)"
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={3}
      />
    </div>
  );
}

export default function MarginPanel({
  annotations, activeAnnotationId, onBodyBlur, onDelete,
  selectionInfo, onCreateAnnotation, onCopySelection, onHighlight,
}) {
  const activeCardRef = useRef();

  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeAnnotationId]);

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.headerTitle}>Annotations</span>
        <span style={s.count}>{annotations.length}</span>
      </div>

      {selectionInfo && (
        <div style={s.toolbar}>
          <div style={s.toolbarLabel}>
            "{selectionInfo.selectedText.slice(0, 50)}{selectionInfo.selectedText.length > 50 ? '…' : ''}"
          </div>
          <div style={s.toolbarBtns}>
            {['N', 'Q', 'C'].map(type => (
              <button
                key={type}
                style={{ ...s.typeBtn, color: TYPE_META[type].color, borderColor: TYPE_META[type].color }}
                onClick={() => onCreateAnnotation(type)}
                title={`${TYPE_META[type].label} (Alt+${type})`}
              >
                {TYPE_META[type].label}
              </button>
            ))}
          </div>
          <div style={{ ...s.toolbarBtns, marginTop: 'var(--space-sm)' }}>
            <button
              style={{ ...s.typeBtn, flex: 'none', padding: '6px 12px', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }}
              onClick={onCopySelection}
              title="Copy"
            >Copy</button>
            <button
              style={{ ...s.typeBtn, flex: 1, color: 'var(--highlight)', borderColor: 'var(--highlight)' }}
              onClick={onHighlight}
              title="Highlight"
            >Highlight</button>
          </div>
        </div>
      )}

      <div style={s.list}>
        {annotations.length === 0 && !selectionInfo && (
          <div style={s.empty}>
            <div style={s.emptyTitle}>No annotations yet</div>
            <div style={s.emptyHint}>
              Select text to annotate
            </div>
          </div>
        )}
        {annotations.map(ann => (
          <AnnotationCard
            key={ann.id}
            annotation={ann}
            isActive={ann.id === activeAnnotationId}
            onBodyBlur={onBodyBlur}
            onDelete={onDelete}
            cardRef={ann.id === activeAnnotationId ? activeCardRef : null}
          />
        ))}
      </div>
    </div>
  );
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-md) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  headerTitle: { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' },
  count: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-pill)',
    padding: '1px 8px',
  },
  toolbar: {
    padding: 'var(--space-md) var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-elevated)',
    flexShrink: 0,
  },
  toolbarLabel: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    marginBottom: 'var(--space-sm)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontStyle: 'italic',
  },
  toolbarBtns: { display: 'flex', gap: 'var(--space-sm)' },
  typeBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid',
    borderRadius: 'var(--radius-md)',
    padding: '10px 0',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    minHeight: '44px',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  empty: {
    marginTop: 'var(--space-3xl)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  emptyTitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  emptyHint: {
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
    lineHeight: 1.8,
  },
  kbd: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 5px',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    marginLeft: '4px',
    marginRight: '8px',
    fontFamily: 'var(--font-ui)',
  },
  card: {
    borderLeft: '3px solid',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-md)',
    flexShrink: 0,
    transition: 'background var(--transition-fast)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-sm)',
  },
  typeBadge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
    padding: '8px',
    minWidth: '36px',
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    fontFamily: 'var(--font-ui)',
  },
  excerpt: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    marginBottom: 'var(--space-sm)',
    lineHeight: 1.4,
  },
  textarea: {
    width: '100%',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-sm)',
    resize: 'vertical',
    fontFamily: 'var(--font-ui)',
    lineHeight: 1.5,
    boxSizing: 'border-box',
    outline: 'none',
  },
};
