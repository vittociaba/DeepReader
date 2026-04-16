import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * ReviewSession — step through concept cards with:
 *   - Feature 2: Confidence calibration (pre-reveal 1–5 prediction)
 *   - Feature 5: Interleaved review (shuffle across books/topics, default on)
 *   - Feature 6: Progressive retrieval difficulty by maturity
 *   - Feature 10: Leech detection warnings + card retirement prompts
 *
 * Props:
 *   cards    — array of card objects (already loaded by parent)
 *   onDone   — called when all cards are reviewed or user quits
 */
export default function ReviewSession({ cards, onDone }) {
  const [interleaved, setInterleaved] = useState(true);
  const orderedCards = useMemo(() => {
    if (!interleaved) return [...cards];
    // Fisher-Yates shuffle
    const arr = [...cards];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [cards, interleaved]);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState(null); // 1–5 pre-reveal
  const [confidenceSubmitted, setConfidenceSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]); // { title, rating, confidence }
  const inputRef = useRef();

  const card = orderedCards[index];

  // Determine review mode based on maturity (Feature 6)
  const getReviewMode = (c) => {
    if (!c) return 'cloze';
    const interval = c.srs_interval || 1;
    if (interval > 60) return 'teach';
    if (interval > 21) return 'explain';
    if (interval >= 7) return 'title_recall';
    return 'cloze';
  };

  const reviewMode = getReviewMode(card);

  // Auto-focus and reset on card change
  useEffect(() => {
    setAnswer('');
    setRevealed(false);
    setConfidence(null);
    setConfidenceSubmitted(false);
    if (inputRef.current) inputRef.current.focus();
  }, [index]);

  if (!card) {
    // Session complete
    return (
      <div style={s.container}>
        <div style={s.complete}>
          <h2 style={s.completeTitle}>Session Complete</h2>
          <p style={s.completeSub}>{results.length} card{results.length !== 1 ? 's' : ''} reviewed</p>
          <div style={s.resultsList}>
            {results.map((r, i) => (
              <div key={i} style={s.resultRow}>
                <span style={s.resultTitle}>{r.title}</span>
                <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                  {r.confidence != null && (
                    <span style={{ ...s.confidenceBadge, opacity: 0.6 }} title="Confidence">
                      🎯{r.confidence}
                    </span>
                  )}
                  <span style={{ ...s.ratingBadge, background: ratingColor(r.rating) }}>
                    {r.rating}/5
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button style={s.doneBtn} onClick={onDone}>Done</button>
        </div>
      </div>
    );
  }

  const maskedBody = card.body.replace(/\{\{c1::([^}]+)\}\}/g, '_____ ');
  const clozeMatch = card.body.match(/\{\{c1::([^}]+)\}\}/);
  const clozeAnswer = clozeMatch ? clozeMatch[1] : null;

  const handleReveal = () => setRevealed(true);

  const handleRate = async (rating) => {
    try {
      await fetch(`/api/concept_cards/${card.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, confidence, review_mode: reviewMode }),
      });
    } catch (_) { /* non-fatal */ }
    setResults(prev => [...prev, { title: card.title, rating, confidence }]);
    setIndex(i => i + 1);
  };

  const handleConfidenceSubmit = () => {
    if (confidence != null) setConfidenceSubmitted(true);
  };

  // ─── Leech & Retirement banners (Feature 10) ──────────────────────────────
  const isLeech = card.status === 'leech';
  const isRetired = card.status === 'retired';

  // ─── Review mode labels (Feature 6) ────────────────────────────────────────
  const MODE_INFO = {
    cloze:        { label: 'Fill in the blank',           icon: '✏️' },
    title_recall: { label: 'Recall from title',           icon: '🧠' },
    explain:      { label: 'Explain in your own words',   icon: '💡' },
    teach:        { label: 'Teach this concept',          icon: '🎓' },
  };
  const modeInfo = MODE_INFO[reviewMode] || MODE_INFO.cloze;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.quitBtn} onClick={onDone}>✕ Quit</button>
        <span style={s.progress}>{index + 1} / {orderedCards.length}</span>
        <label style={s.interleaveToggle} title="Mixing cards from different topics improves retention (interleaving effect)">
          <input
            type="checkbox"
            checked={interleaved}
            onChange={e => setInterleaved(e.target.checked)}
            style={{ marginRight: 'var(--space-xs)' }}
          />
          Interleaved
        </label>
      </div>

      <div style={s.card}>
        {/* Leech / Retired banners */}
        {isLeech && (
          <div style={s.leechBanner}>
            ⚠️ This card keeps failing. The problem might be the card, not your memory.
            Consider rewriting it: keep it atomic (one idea), with a clear question.
          </div>
        )}
        {isRetired && (
          <div style={s.retiredBanner}>
            🏆 This card is retired — this is a surprise annual review.
          </div>
        )}

        {/* Review mode badge */}
        <div style={s.modeBadge}>
          <span>{modeInfo.icon} {modeInfo.label}</span>
          <span style={s.modeInterval}>Interval: {card.srs_interval}d</span>
        </div>

        {/* Card meta */}
        <div style={s.meta}>
          <span style={s.cardTitle}>{card.title}</span>
          <span style={s.source}>{card.source_book} — {card.source_page}</span>
        </div>

        {/* ─── MODE: cloze (default) ─────────────────────────────────── */}
        {reviewMode === 'cloze' && (
          <>
            <div style={s.body}>
              {revealed
                ? <span dangerouslySetInnerHTML={{
                    __html: card.body.replace(
                      /\{\{c1::([^}]+)\}\}/g,
                      '<mark style="background:#2a5a2a;color:#4adf8a;padding:0 4px;border-radius:3px">$1</mark>'
                    )
                  }} />
                : maskedBody
              }
            </div>
            {clozeAnswer && !revealed && !confidenceSubmitted && (
              <ConfidencePrompt confidence={confidence} setConfidence={setConfidence} onSubmit={handleConfidenceSubmit} />
            )}
            {clozeAnswer && !revealed && confidenceSubmitted && (
              <div style={s.inputRow}>
                <input
                  ref={inputRef}
                  style={s.input}
                  placeholder="Your answer…"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleReveal(); }}
                  autoFocus
                />
                <button style={s.revealBtn} onClick={handleReveal}>Reveal</button>
              </div>
            )}
            {!clozeAnswer && !revealed && !confidenceSubmitted && (
              <ConfidencePrompt confidence={confidence} setConfidence={setConfidence} onSubmit={handleConfidenceSubmit} />
            )}
            {!clozeAnswer && !revealed && confidenceSubmitted && (
              <button style={s.revealBtn} onClick={handleReveal}>Show card</button>
            )}
          </>
        )}

        {/* ─── MODE: title_recall (Young cards, interval < 7d) ──────── */}
        {reviewMode === 'title_recall' && (
          <>
            {!revealed && (
              <div style={s.promptBox}>
                <p style={s.promptText}>
                  You see the title above. Write what you remember about this concept:
                </p>
                {!confidenceSubmitted ? (
                  <ConfidencePrompt confidence={confidence} setConfidence={setConfidence} onSubmit={handleConfidenceSubmit} />
                ) : (
                  <>
                    <textarea
                      ref={inputRef}
                      style={s.recallTextarea}
                      placeholder="Write what you recall…"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      rows={4}
                      autoFocus
                    />
                    <button style={s.revealBtn} onClick={handleReveal}>Reveal</button>
                  </>
                )}
              </div>
            )}
            {revealed && (
              <div style={s.body}>
                <span dangerouslySetInnerHTML={{
                  __html: card.body.replace(
                    /\{\{c1::([^}]+)\}\}/g,
                    '<mark style="background:#2a5a2a;color:#4adf8a;padding:0 4px;border-radius:3px">$1</mark>'
                  )
                }} />
              </div>
            )}
          </>
        )}

        {/* ─── MODE: explain (Mature cards, interval > 21d) ─────────── */}
        {reviewMode === 'explain' && (
          <>
            {!revealed && (
              <div style={s.promptBox}>
                <p style={s.promptText}>
                  From "{card.source_book}" — explain this concept in your own words:
                </p>
                {!confidenceSubmitted ? (
                  <ConfidencePrompt confidence={confidence} setConfidence={setConfidence} onSubmit={handleConfidenceSubmit} />
                ) : (
                  <>
                    <textarea
                      ref={inputRef}
                      style={s.recallTextarea}
                      placeholder="Explain the concept…"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      rows={5}
                      autoFocus
                    />
                    <button style={s.revealBtn} onClick={handleReveal}>Show Original</button>
                  </>
                )}
              </div>
            )}
            {revealed && (
              <>
                <div style={s.comparison}>
                  <div style={s.yourAnswer}>
                    <span style={s.compLabel}>Your explanation:</span>
                    <span style={s.compText}>{answer || '(blank)'}</span>
                  </div>
                </div>
                <div style={s.body}>
                  <span dangerouslySetInnerHTML={{
                    __html: card.body.replace(
                      /\{\{c1::([^}]+)\}\}/g,
                      '<mark style="background:#2a5a2a;color:#4adf8a;padding:0 4px;border-radius:3px">$1</mark>'
                    )
                  }} />
                </div>
              </>
            )}
          </>
        )}

        {/* ─── MODE: teach (Veteran cards, interval > 60d) ──────────── */}
        {reviewMode === 'teach' && (
          <>
            {!revealed && (
              <div style={s.promptBox}>
                <p style={s.promptText}>
                  🎓 Teach this concept to someone. Write a clear explanation as if
                  the reader has never heard of it:
                </p>
                {!confidenceSubmitted ? (
                  <ConfidencePrompt confidence={confidence} setConfidence={setConfidence} onSubmit={handleConfidenceSubmit} />
                ) : (
                  <>
                    <textarea
                      ref={inputRef}
                      style={s.recallTextarea}
                      placeholder="Write your teaching explanation…"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      rows={6}
                      autoFocus
                    />
                    <button style={s.revealBtn} onClick={handleReveal}>Compare</button>
                  </>
                )}
              </div>
            )}
            {revealed && (
              <>
                <div style={s.comparison}>
                  <div style={s.yourAnswer}>
                    <span style={s.compLabel}>Your teaching:</span>
                    <span style={s.compText}>{answer || '(blank)'}</span>
                  </div>
                </div>
                <div style={s.body}>
                  <span dangerouslySetInnerHTML={{
                    __html: card.body.replace(
                      /\{\{c1::([^}]+)\}\}/g,
                      '<mark style="background:#2a5a2a;color:#4adf8a;padding:0 4px;border-radius:3px">$1</mark>'
                    )
                  }} />
                </div>
              </>
            )}
          </>
        )}

        {/* Answer comparison for cloze mode after reveal */}
        {reviewMode === 'cloze' && clozeAnswer && revealed && (
          <div style={s.comparison}>
            <div style={s.yourAnswer}>
              <span style={s.compLabel}>Your answer:</span>
              <span style={s.compText}>{answer || '(blank)'}</span>
            </div>
            <div style={s.correctAnswer}>
              <span style={s.compLabel}>Correct:</span>
              <span style={{ ...s.compText, color: 'var(--accent-green)' }}>{clozeAnswer}</span>
            </div>
          </div>
        )}

        {/* Rating buttons */}
        {revealed && (
          <div style={s.ratingRow}>
            <span style={s.ratingLabel}>How well did you recall it?</span>
            <div style={s.ratingBtns}>
              {[1, 2, 3, 4, 5].map(r => (
                <button
                  key={r}
                  style={{ ...s.rateBtn, background: ratingColor(r) }}
                  onClick={() => handleRate(r)}
                  title={RATING_LABELS[r]}
                >
                  {r}
                </button>
              ))}
            </div>
            <div style={s.ratingHints}>
              {[1, 2, 3, 4, 5].map(r => (
                <span key={r} style={s.ratingHint}>{RATING_LABELS[r]}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ConfidencePrompt (Feature 2) ──────────────────────────────────────────

function ConfidencePrompt({ confidence, setConfidence, onSubmit }) {
  return (
    <div style={s.confidenceBox}>
      <span style={s.confidenceLabel}>Before you answer — how confident are you?</span>
      <div style={s.confidenceBtns}>
        {[1, 2, 3, 4, 5].map(c => (
          <button
            key={c}
            style={{
              ...s.confBtn,
              background: confidence === c ? CONF_COLORS[c] : 'var(--bg-surface)',
              borderColor: confidence === c ? CONF_COLORS[c] : 'var(--border)',
            }}
            onClick={() => setConfidence(c)}
            title={CONF_LABELS[c]}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={s.confidenceHints}>
        {[1, 2, 3, 4, 5].map(c => (
          <span key={c} style={s.confidenceHint}>{CONF_LABELS[c]}</span>
        ))}
      </div>
      <button
        style={{ ...s.revealBtn, opacity: confidence == null ? 0.4 : 1, marginTop: 'var(--space-sm)' }}
        onClick={onSubmit}
        disabled={confidence == null}
      >
        Continue →
      </button>
    </div>
  );
}

// ─── constants ────────────────────────────────────────────────────────────────

const RATING_LABELS = {
  1: 'Blackout',
  2: 'Wrong',
  3: 'Hard',
  4: 'Good',
  5: 'Easy',
};

const CONF_LABELS = {
  1: 'No idea',
  2: 'Unsure',
  3: 'Maybe',
  4: 'Likely',
  5: 'Certain',
};

const CONF_COLORS = {
  1: '#7a1c1c',
  2: '#7a4a1c',
  3: '#4a4a1c',
  4: '#1c4a3a',
  5: '#1c4a1c',
};

function ratingColor(r) {
  return ['', '#7a1c1c', '#7a4a1c', '#4a4a1c', '#1c4a3a', '#1c4a1c'][r];
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'var(--bg-deep)',
    color: 'var(--text-primary)',
    padding: 'var(--space-2xl) var(--space-md)',
    overflowY: 'auto',
  },
  header: {
    width: '100%',
    maxWidth: '680px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-xl)',
  },
  quitBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-ui)',
  },
  progress: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-faint)',
  },
  interleaveToggle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '680px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-2xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-lg)',
  },
  leechBanner: {
    background: 'var(--accent-red-dim)',
    border: '1px solid var(--accent-red)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-sm) var(--space-md)',
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-red)',
    lineHeight: 1.5,
  },
  retiredBanner: {
    background: 'var(--accent-blue-dim)',
    border: '1px solid var(--accent-blue)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-sm) var(--space-md)',
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-blue)',
    lineHeight: 1.5,
  },
  modeBadge: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    background: 'var(--bg-deep)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
  },
  modeInterval: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: 'var(--space-md)',
  },
  cardTitle: {
    fontSize: 'var(--text-md)',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  source: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
  },
  body: {
    fontSize: 'var(--text-base)',
    lineHeight: 1.8,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-reading)',
    minHeight: '3rem',
  },
  promptBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  promptText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    lineHeight: 1.5,
    margin: 0,
  },
  recallTextarea: {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-sm)',
    resize: 'vertical',
    fontFamily: 'var(--font-reading)',
    lineHeight: 1.7,
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputRow: {
    display: 'flex',
    gap: 'var(--space-sm)',
  },
  input: {
    flex: 1,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-sm) var(--space-md)',
    outline: 'none',
  },
  revealBtn: {
    background: 'var(--accent-blue-dim)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-blue)',
    padding: 'var(--space-sm) var(--space-lg)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    flexShrink: 0,
  },
  comparison: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    background: 'var(--bg-deep)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--space-sm) var(--space-md)',
  },
  yourAnswer: { display: 'flex', gap: 'var(--space-sm)', alignItems: 'baseline', flexWrap: 'wrap' },
  correctAnswer: { display: 'flex', gap: 'var(--space-sm)', alignItems: 'baseline' },
  compLabel: { fontSize: 'var(--text-xs)', color: 'var(--text-faint)', minWidth: '80px', flexShrink: 0 },
  compText: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 },
  ratingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: 'var(--space-md)',
  },
  ratingLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  },
  ratingBtns: {
    display: 'flex',
    gap: 'var(--space-sm)',
  },
  rateBtn: {
    flex: 1,
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: '#fff',
    fontSize: 'var(--text-md)',
    fontWeight: 700,
    fontFamily: 'var(--font-ui)',
    padding: 'var(--space-sm) 0',
    cursor: 'pointer',
  },
  ratingHints: {
    display: 'flex',
    gap: 'var(--space-sm)',
  },
  ratingHint: {
    flex: 1,
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    textAlign: 'center',
  },
  // ─── Confidence (Feature 2) ───
  confidenceBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
    background: 'var(--accent-blue-dim)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-md)',
    border: '1px solid var(--accent-blue)',
  },
  confidenceLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-blue)',
    fontWeight: 600,
  },
  confidenceBtns: {
    display: 'flex',
    gap: 'var(--space-xs)',
  },
  confBtn: {
    flex: 1,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: '#fff',
    fontSize: 'var(--text-base)',
    fontWeight: 700,
    fontFamily: 'var(--font-ui)',
    padding: 'var(--space-sm) 0',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
  confidenceHints: {
    display: 'flex',
    gap: 'var(--space-xs)',
  },
  confidenceHint: {
    flex: 1,
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    textAlign: 'center',
  },
  confidenceBadge: {
    fontSize: 'var(--text-xs)',
    color: 'var(--accent-blue)',
  },
  // ─── Session complete ───
  complete: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-md)',
    maxWidth: '480px',
    width: '100%',
    marginTop: 'var(--space-2xl)',
  },
  completeTitle: {
    fontSize: 'var(--text-xl)',
    fontWeight: 700,
    color: 'var(--accent-green)',
    margin: 0,
  },
  completeSub: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    margin: 0,
  },
  resultsList: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--space-sm) var(--space-md)',
  },
  resultTitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  ratingBadge: {
    fontSize: 'var(--text-xs)',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem var(--space-xs)',
    marginLeft: 'var(--space-sm)',
    flexShrink: 0,
  },
  doneBtn: {
    marginTop: 'var(--space-md)',
    background: 'var(--accent-blue-dim)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'var(--accent-blue)',
    padding: 'var(--space-sm) var(--space-2xl)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
};
