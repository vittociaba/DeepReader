import React, { useState, useEffect } from 'react';
import AnnotationLifecycleDashboard from './AnnotationLifecycleDashboard';

const TYPE_META = {
  N: { label: 'Note',     color: 'var(--accent-blue)' },
  Q: { label: 'Question', color: 'var(--accent-amber)' },
  C: { label: 'Concept',  color: 'var(--accent-green)' },
};

/**
 * SessionHarvestView — post-session screen.
 *
 * Fetches all annotations from the session, groups them by page, lets the
 * user promote any annotation to a concept card (writes YAML Markdown to
 * /data/vault/).
 *
 * Props:
 *   sessionId — active or ended session UUID
 *   book      — { id, title, author }
 *   onBack    — go back to reader
 *   onDone    — go back to library
 */
export default function SessionHarvestView({ sessionId, book, onBack, onDone }) {
  const [harvestData, setHarvestData] = useState(null);  // { session, annotations }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // promotedMap: annotationId → card object returned by POST /api/concept_cards
  const [promotedMap, setPromotedMap] = useState({});
  // activePromote: annotationId being promoted right now (form is open)
  const [activePromote, setActivePromote] = useState(null);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    fetch(`/api/sessions/${sessionId}/harvest`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setHarvestData(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div style={s.center}>Loading session…</div>;
  if (error)   return <div style={{ ...s.center, color: 'var(--accent-red)' }}>Error: {error}</div>;
  if (!harvestData) return <div style={s.center}>No session data.</div>;

  const { session, annotations } = harvestData;
  const promoted = Object.keys(promotedMap).length;

  // Group annotations by (chapter_index, page_index)
  const pages = groupByPage(annotations);

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← Back to Reader</button>
        <div style={s.headerMid}>
          <span style={s.headerTitle}>Session Harvest</span>
          <span style={s.headerMeta}>
            {book.title} · {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
            {promoted > 0 && ` · ${promoted} promoted`}
          </span>
        </div>
        <button style={s.doneBtn} onClick={onDone}>Done</button>
      </div>

      <div style={{ padding: 'var(--space-md) var(--space-xl) 0', maxWidth: '900px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <AnnotationLifecycleDashboard sessionId={sessionId} />
      </div>

      {/* Body */}
      <div style={s.body}>
        {annotations.length === 0 ? (
          <div style={s.empty}>No annotations in this session yet.</div>
        ) : (
          pages.map(({ chapterIndex, pageIndex, items }) => (
            <div key={`${chapterIndex}-${pageIndex}`} style={s.pageGroup}>
              <div style={s.pageHeading}>
                Chapter {chapterIndex + 1} &middot; Page {pageIndex + 1}
              </div>
              {items.map(ann => (
                <AnnotationRow
                  key={ann.id}
                  annotation={ann}
                  book={book}
                  promoted={promotedMap[ann.id]}
                  isActive={activePromote === ann.id}
                  onPromoteClick={() => setActivePromote(ann.id)}
                  onCancelPromote={() => setActivePromote(null)}
                  onCardCreated={(card) => {
                    setPromotedMap(prev => ({ ...prev, [ann.id]: card }));
                    setActivePromote(null);
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── AnnotationRow ─────────────────────────────────────────────────────────────

function AnnotationRow({ annotation, book, promoted, isActive, onPromoteClick, onCancelPromote, onCardCreated }) {
  const meta = TYPE_META[annotation.type] || TYPE_META.N;

  return (
    <div style={s.annotRow}>
      <div style={s.annotMain}>
        {/* Type + excerpt */}
        <div style={s.annotHeader}>
          <span style={{ ...s.typeBadge, color: meta.color }}>{meta.label}</span>
          <span style={s.excerpt}>
            "{annotation.selected_text.length > 100
              ? annotation.selected_text.slice(0, 100) + '…'
              : annotation.selected_text}"
          </span>
        </div>
        {annotation.body && (
          <div style={s.annotBody}>{annotation.body}</div>
        )}
      </div>

      {/* Right side: promote button or form or success */}
      <div style={s.annotAction}>
        {promoted ? (
          <PromoteSuccess card={promoted} />
        ) : isActive ? (
          <PromoteForm
            annotation={annotation}
            book={book}
            onCancel={onCancelPromote}
            onCreated={onCardCreated}
          />
        ) : (
          <button style={s.promoteBtn} onClick={onPromoteClick}>
            + Promote to Card
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PromoteForm ──────────────────────────────────────────────────────────────

function PromoteForm({ annotation, book, onCancel, onCreated }) {
  const defaultTitle = annotation.body
    ? annotation.body.slice(0, 60).split('\n')[0]
    : annotation.selected_text.slice(0, 60);

  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(
    annotation.body || annotation.selected_text
  );
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const sourcePage = `ch${annotation.chapter_index + 1} p${annotation.page_index + 1}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setErr(null);
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    try {
      const r = await fetch('/api/concept_cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annotation_id: annotation.id,
          title: title.trim(),
          source_book: book.title || 'Unknown',
          source_page: sourcePage,
          body: body.trim(),
          tags,
        }),
      });
      const card = await r.json();
      if (!r.ok) throw new Error(card.error || 'Failed to create card');
      onCreated(card);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form style={s.promoteForm} onSubmit={handleSubmit}>
      <input
        style={s.formInput}
        placeholder="Card title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
        autoFocus
      />
      <textarea
        style={s.formTextarea}
        placeholder="Card body (use {{c1::text}} for cloze)…"
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        required
      />
      <input
        style={s.formInput}
        placeholder="Tags (comma-separated)…"
        value={tagsInput}
        onChange={e => setTagsInput(e.target.value)}
      />
      {err && <span style={s.formErr}>{err}</span>}
      <div style={s.formBtns}>
        <button type="button" style={s.cancelBtn} onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" style={s.submitBtn} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Card'}
        </button>
      </div>
    </form>
  );
}

// ─── PromoteSuccess ──────────────────────────────────────────────────────────

function PromoteSuccess({ card }) {
  const fname = card.vault_path
    ? card.vault_path.replace(/.*[/\\]/, '')
    : null;
  return (
    <div style={s.successBox}>
      <span style={s.successIcon}>✓</span>
      <div style={s.successText}>
        <span style={s.successTitle}>{card.title}</span>
        {fname && <span style={s.successPath}>{fname}</span>}
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupByPage(annotations) {
  const map = new Map();
  for (const ann of annotations) {
    const key = `${ann.chapter_index}-${ann.page_index}`;
    if (!map.has(key)) {
      map.set(key, { chapterIndex: ann.chapter_index, pageIndex: ann.page_index, items: [] });
    }
    map.get(key).items.push(ann);
  }
  return [...map.values()];
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#14120f',
    color: '#e8e0d8',
    overflow: 'hidden',
    colorScheme: 'dark',
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: 'var(--text-sm)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: '0 var(--space-md)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-base)',
    height: '52px',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    color: 'var(--accent-blue)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    fontFamily: 'var(--font-ui)',
    flexShrink: 0,
  },
  headerMid: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
  },
  headerMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  doneBtn: {
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--accent-green)',
    padding: 'var(--space-xs) var(--space-md)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-md) var(--space-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-lg)',
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  empty: {
    marginTop: 'var(--space-2xl)',
    textAlign: 'center',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
  },
  pageGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  pageHeading: {
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    paddingBottom: 'var(--space-xs)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  annotRow: {
    display: 'flex',
    gap: 'var(--space-md)',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-sm) var(--space-md)',
    alignItems: 'flex-start',
  },
  annotMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    minWidth: 0,
  },
  annotHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--space-sm)',
    flexWrap: 'wrap',
  },
  typeBadge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  excerpt: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
  annotBody: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginTop: '0.1rem',
    whiteSpace: 'pre-wrap',
  },
  annotAction: {
    flexShrink: 0,
    minWidth: '160px',
    maxWidth: '320px',
    display: 'flex',
    alignItems: 'flex-start',
  },
  promoteBtn: {
    background: 'none',
    border: '1px solid var(--accent-blue)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-blue)',
    padding: 'var(--space-xs) var(--space-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  promoteForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    width: '100%',
  },
  formInput: {
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  formTextarea: {
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    padding: 'var(--space-xs) var(--space-sm)',
    outline: 'none',
    width: '100%',
    resize: 'vertical',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  formErr: {
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-red)',
  },
  formBtns: {
    display: 'flex',
    gap: 'var(--space-xs)',
    justifyContent: 'flex-end',
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
  submitBtn: {
    background: 'var(--accent-blue-dim)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-blue)',
    padding: 'var(--space-xs) var(--space-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
  },
  successBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-xs)',
  },
  successIcon: {
    color: 'var(--accent-green)',
    fontWeight: 700,
    fontSize: 'var(--text-sm)',
    flexShrink: 0,
    marginTop: '0.05rem',
  },
  successText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  successTitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  successPath: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
};
