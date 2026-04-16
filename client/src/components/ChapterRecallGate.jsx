import React, { useState } from 'react';

/**
 * ChapterRecallGate — Feature 1
 * Free-recall screen shown after finishing the last page of a chapter.
 * "What were the key ideas in this chapter? Write what you remember — don't look back."
 *
 * Props:
 *   bookId        — current book ID
 *   chapterIndex  — chapter the user just finished
 *   chapterTitle  — chapter title for display
 *   onContinue    — called after saving or skipping, navigate to next chapter
 */
export default function ChapterRecallGate({ bookId, chapterIndex, chapterTitle, onContinue }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/chapter_recalls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          chapter_index: chapterIndex,
          recall_text: text.trim(),
        }),
      });
      setSaved(true);
      setTimeout(() => onContinue(), 600);
    } catch (_) {
      onContinue(); // Don't block on failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.badge}>📝 Chapter Recall</span>
          <span style={s.chapter}>{chapterTitle || `Chapter ${chapterIndex + 1}`}</span>
        </div>

        <p style={s.prompt}>
          What were the key ideas in this chapter?
          Write what you remember — <strong style={{ color: 'var(--text-primary)' }}>don't look back.</strong>
        </p>

        <p style={s.science}>
          The effort of trying to recall is what cements the memory.
          This discomfort is a "desirable difficulty" — it's meant to feel hard.
        </p>

        <textarea
          style={s.textarea}
          placeholder="Write freely — no hints, no peeking. Just retrieve what you can…"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={8}
          autoFocus
          disabled={saved}
        />

        <div style={s.actions}>
          <button
            style={s.skipBtn}
            onClick={onContinue}
            disabled={saving}
          >
            Skip for now
          </button>
          <button
            style={{
              ...s.saveBtn,
              opacity: !text.trim() || saving ? 0.5 : 1,
              background: saved ? 'var(--accent-green-dim)' : 'var(--accent-green-muted)',
            }}
            onClick={handleSave}
            disabled={!text.trim() || saving || saved}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'var(--space-lg)',
    colorScheme: 'dark',
  },
  modal: {
    background: '#1e1b18',
    border: '1px solid #3a3530',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-xl)',
    maxWidth: '640px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-lg)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
    color: '#e8e0d8',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  badge: {
    fontSize: 'var(--text-xs)',
    color: '#f0a858',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  chapter: {
    fontSize: 'var(--text-lg)',
    fontWeight: 700,
    color: '#e8e0d8',
  },
  prompt: {
    fontSize: 'var(--text-base)',
    color: '#b8b0a8',
    lineHeight: 1.6,
    margin: 0,
  },
  science: {
    fontSize: 'var(--text-xs)',
    color: '#8a8078',
    fontStyle: 'italic',
    lineHeight: 1.5,
    margin: 0,
    borderLeft: '2px solid #3a3530',
    paddingLeft: 'var(--space-sm)',
  },
  textarea: {
    width: '100%',
    background: '#14120f',
    border: '1px solid #3a3530',
    borderRadius: 'var(--radius-lg)',
    color: '#e8e0d8',
    fontSize: '16px',
    padding: 'var(--space-md)',
    resize: 'vertical',
    fontFamily: 'var(--font-reading)',
    lineHeight: 1.8,
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: '160px',
    colorScheme: 'dark',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: '#6b6259',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
    padding: '10px 14px',
    minHeight: '44px',
  },
  saveBtn: {
    border: '1px solid #4adf8a',
    borderRadius: 'var(--radius-md)',
    color: '#4adf8a',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    minHeight: '44px',
    transition: 'var(--transition-fast)',
  },
};
