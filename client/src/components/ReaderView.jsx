import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReaderPane from './ReaderPane';
import ProgressRibbon from './ProgressRibbon';
import MarginPanel from './MarginPanel';
import SessionHarvestView from './SessionHarvestView';
import ChapterRecallGate from './ChapterRecallGate';
import ReaderSettings from './ReaderSettings';
import { useIsMobile } from '../hooks/useIsMobile';
import { useReaderSettings } from '../hooks/useReaderSettings';

const DEFAULT_PANEL_WIDTH = 360;

export default function ReaderView({ book, onBack, onReview, onVocab }) {
  const isMobile = useIsMobile();
  const [readerSettings, updateReaderSettings] = useReaderSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [toc, setToc] = useState([]);
  const [chapterIndex, setChapterIndex] = useState(() => {
    try { const s = localStorage.getItem(`pos:${book.id}`); if (s) return JSON.parse(s).ci; } catch (_) {}
    return 0;
  });
  const [pageIndex, setPageIndex] = useState(() => {
    try { const s = localStorage.getItem(`pos:${book.id}`); if (s) return JSON.parse(s).pi; } catch (_) {}
    return 0;
  });
  const [positionReady, setPositionReady] = useState(
    () => !!localStorage.getItem(`pos:${book.id}`)
  );
  const [panelWidth] = useState(
    () => parseInt(localStorage.getItem('panelWidth') || String(DEFAULT_PANEL_WIDTH), 10)
  );
  const [sessionId, setSessionId] = useState(null);
  const [showHarvest, setShowHarvest] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [selectionInfo, setSelectionInfo] = useState(null);
  const [showRecallGate, setShowRecallGate] = useState(false);
  const [pendingChapter, setPendingChapter] = useState(null);
  const pageStartRef = useRef(Date.now());
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const breakTimerRef = useRef(null);
  const [vocabPopup, setVocabPopup] = useState(null);
  const [vocabLang, setVocabLang] = useState('en');
  const [vocabTrans, setVocabTrans] = useState('');
  const [vocabSaving, setVocabSaving] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);

  useEffect(() => {
    fetch(`/api/books/${book.id}/toc`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setToc(data);
        if (!positionReady) {
          const first = data.find(ch => ch.page_count > 0);
          if (first) setChapterIndex(first.chapter_index);
          setPositionReady(true);
        }
      })
      .catch(() => { setToc([]); setPositionReady(true); });
  }, [book.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ensureSession = async () => {
      const stored = localStorage.getItem('active_session_id');
      if (stored) {
        try {
          const r = await fetch(`/api/sessions/${stored}/touch`, { method: 'PATCH' });
          const data = await r.json();
          if (!data.ended) { setSessionId(stored); return; }
        } catch (_) {}
      }
      try {
        const r = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_id: book.id }),
        });
        const session = await r.json();
        if (session.id) {
          localStorage.setItem('active_session_id', session.id);
          setSessionId(session.id);
        }
      } catch (_) {}
    };
    ensureSession();
  }, [book.id]);

  // Fetch all annotations for the chapter (client-side pagination makes per-page queries invalid)
  useEffect(() => {
    setAnnotations([]);
    setActiveAnnotationId(null);
    fetch(`/api/annotations?book_id=${book.id}&chapter=${chapterIndex}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setAnnotations(data) : setAnnotations([]))
      .catch(() => setAnnotations([]));
  }, [book.id, chapterIndex]);

  // Fetch all highlights for the chapter
  useEffect(() => {
    setHighlights([]);
    fetch(`/api/highlights?book_id=${book.id}&chapter=${chapterIndex}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setHighlights(data) : setHighlights([]))
      .catch(() => setHighlights([]));
  }, [book.id, chapterIndex]);

  const sendReadingTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - pageStartRef.current) / 1000);
    if (elapsed > 2 && sessionId) {
      fetch('/api/reading_time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId, book_id: book.id,
          chapter_index: chapterIndex, page_index: pageIndex,
          seconds_spent: elapsed,
        }),
      }).catch(() => {});
    }
    pageStartRef.current = Date.now();
  }, [sessionId, book.id, chapterIndex, pageIndex]);

  const navigateTo = (ci, pi) => {
    sendReadingTime();
    const currentChapter = toc.find(ch => ch.chapter_index === chapterIndex);
    if (ci > chapterIndex && currentChapter) {
      setPendingChapter(ci);
      setShowRecallGate(true);
      return;
    }
    setChapterIndex(ci);
    setPageIndex(pi);
    setSelectionInfo(null);
    localStorage.setItem(`pos:${book.id}`, JSON.stringify({ ci, pi }));
  };

  const createAnnotation = useCallback(async (type) => {
    if (!selectionInfo || !sessionId) return;
    try {
      const r = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: book.id, session_id: sessionId,
          chapter_index: chapterIndex, page_index: pageIndex,
          paragraph_index: selectionInfo.paragraphIndex,
          char_offset: selectionInfo.charOffset,
          selected_text: selectionInfo.selectedText, type,
        }),
      });
      const annotation = await r.json();
      if (annotation.id) {
        setAnnotations(prev => [...prev, annotation]);
        setActiveAnnotationId(annotation.id);
        setSelectionInfo(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch (_) {}
  }, [selectionInfo, sessionId, book.id, chapterIndex, pageIndex]);

  const handleCopySelection = useCallback(() => {
    if (!selectionInfo) return;
    navigator.clipboard.writeText(selectionInfo.selectedText).catch(() => {});
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionInfo]);

  const handleHighlight = useCallback(async () => {
    if (!selectionInfo) return;
    navigator.clipboard.writeText(selectionInfo.selectedText).catch(() => {});
    try {
      const r = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: book.id, chapter_index: chapterIndex, page_index: pageIndex,
          paragraph_index: selectionInfo.paragraphIndex,
          char_offset: selectionInfo.charOffset,
          length: selectionInfo.selectedText.length,
          selected_text: selectionInfo.selectedText,
        }),
      });
      const hl = await r.json();
      if (hl.id) setHighlights(prev => [...prev, hl]);
    } catch (_) {}
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionInfo, book.id, chapterIndex, pageIndex]);

  const copyChapter = useCallback(async () => {
    try {
      const r = await fetch(`/api/books/${book.id}/chapter/${chapterIndex}/text`);
      const data = await r.json();
      if (data.text) await navigator.clipboard.writeText(data.text);
    } catch (_) {}
  }, [book.id, chapterIndex]);

  const exportChapter = useCallback(async (format) => {
    try {
      const r = await fetch(`/api/books/${book.id}/chapter/${chapterIndex}/text`);
      const data = await r.json();
      if (!data.text) return;
      const content = format === 'md' ? `# ${data.title}\n\n${data.text}` : data.text;
      const ext = format === 'md' ? '.md' : '.txt';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${data.title}${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, [book.id, chapterIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); createAnnotation('N'); }
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); createAnnotation('Q'); }
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); createAnnotation('C'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createAnnotation]);

  const handleBodyBlur = useCallback(async (id, body) => {
    try {
      await fetch(`/api/annotations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      setAnnotations(prev => prev.map(a => a.id === id ? { ...a, body } : a));
    } catch (_) {}
  }, []);

  const handleDeleteAnnotation = useCallback(async (id) => {
    try {
      await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
      setAnnotations(prev => prev.filter(a => a.id !== id));
      if (activeAnnotationId === id) setActiveAnnotationId(null);
    } catch (_) {}
  }, [activeAnnotationId]);

  const handleWordDoubleClick = useCallback(({ word, context }) => {
    setVocabPopup({ word, context });
    setVocabLang('en'); setVocabTrans('');
  }, []);

  const saveVocabCard = useCallback(async () => {
    if (!vocabPopup) return;
    setVocabSaving(true);
    try {
      await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: vocabPopup.word, translation: vocabTrans.trim() || null,
          context: vocabPopup.context || null, book_id: book.id,
          source_page: `ch${chapterIndex + 1} p${pageIndex + 1}`,
          language: vocabLang,
        }),
      });
      setVocabPopup(null); setVocabTrans('');
    } catch (_) {}
    setVocabSaving(false);
  }, [vocabPopup, vocabTrans, vocabLang, book.id, chapterIndex, pageIndex]);

  useEffect(() => {
    breakTimerRef.current = setInterval(() => {
      setSessionSeconds(prev => {
        const next = prev + 60;
        if (next >= 45 * 60 && !showBreakReminder) setShowBreakReminder(true);
        return next;
      });
    }, 60 * 1000);
    return () => clearInterval(breakTimerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (showRecallGate) {
    const chapterTitle = toc.find(ch => ch.chapter_index === chapterIndex)?.title;
    return (
      <ChapterRecallGate
        bookId={book.id} chapterIndex={chapterIndex} chapterTitle={chapterTitle}
        onContinue={() => {
          setShowRecallGate(false);
          if (pendingChapter != null) {
            setChapterIndex(pendingChapter); setPageIndex(0); setSelectionInfo(null);
            localStorage.setItem(`pos:${book.id}`, JSON.stringify({ ci: pendingChapter, pi: 0 }));
            setPendingChapter(null);
          }
        }}
      />
    );
  }

  if (showHarvest) {
    return <SessionHarvestView sessionId={sessionId} book={book} onBack={() => setShowHarvest(false)} onDone={onBack} />;
  }

  const sessionMin = Math.floor(sessionSeconds / 60);
  const sessionTimerLabel = sessionMin >= 60
    ? `${Math.floor(sessionMin / 60)}h${sessionMin % 60}m`
    : `${sessionMin}m`;

  // Compute progress for mobile ribbon
  const totalPages = toc.reduce((sum, ch) => sum + ch.page_count, 0);
  const offsets = [];
  let acc = 0;
  for (const ch of toc) { offsets.push(acc); acc += ch.page_count; }
  const currentAbsolute = (offsets[chapterIndex] || 0) + pageIndex;
  const progressPct = totalPages > 0 ? Math.round((currentAbsolute / Math.max(totalPages - 1, 1)) * 100) : 0;

  return (
    <div style={s.container}>
      {/* Top bar */}
      <div style={{ ...s.topBar, ...(isMobile ? s.topBarMobile : {}) }}>
        <button style={{ ...s.backBtn, ...(isMobile ? s.touchBtn : {}) }} onClick={onBack}>←</button>
        <span style={{ ...s.bookTitle, ...(isMobile ? s.bookTitleMobile : {}) }}>
          {book.title || 'Untitled'}
        </span>

        {sessionMin > 0 && !isMobile && (
          <span style={s.timerBadge}>{sessionTimerLabel}</span>
        )}

        {/* Desktop: chapter selector + actions */}
        {!isMobile && toc.length > 0 && (
          <select
            style={s.chapterSelect}
            value={chapterIndex}
            onChange={e => navigateTo(parseInt(e.target.value, 10), 0)}
          >
            {toc.map(ch => (
              <option key={ch.chapter_index} value={ch.chapter_index}>{ch.title}</option>
            ))}
          </select>
        )}

        {!isMobile && (
          <div style={s.actionGroup}>
            <button style={s.toolBtn} onClick={() => setShowSettings(v => !v)} title="Reading settings">Aa</button>
            <button style={s.toolBtn} onClick={copyChapter} title="Copy chapter text">Copy</button>
            <button style={s.toolBtn} onClick={() => exportChapter('md')} title="Export .md">.md</button>
            <button style={s.toolBtn} onClick={onReview} title="Review cards">Review</button>
            {sessionId && (
              <button style={s.harvestBtn} onClick={() => setShowHarvest(true)}>Harvest</button>
            )}
          </div>
        )}

        {/* Mobile: menu + settings + notes buttons */}
        {isMobile && (
          <>
            <button
              style={{ ...s.mobileIconBtn, ...(showMobileMenu ? { background: 'var(--bg-active)' } : {}) }}
              onClick={() => { setShowMobileMenu(v => !v); setShowChapterPicker(false); }}
            >
              ⋯
            </button>
            <button
              style={{ ...s.mobileIconBtn, fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.03em' }}
              onClick={() => setShowSettings(v => !v)}
            >
              Aa
            </button>
            <button
              style={{ ...s.mobileIconBtn, color: annotations.length > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}
              onClick={() => setShowMobilePanel(v => !v)}
            >
              {annotations.length > 0 ? `✎${annotations.length}` : '✎'}
            </button>
          </>
        )}
      </div>

      {/* Mobile progress bar */}
      {isMobile && (
        <div style={s.mobileProgress}>
          <div style={{ ...s.mobileProgressFill, width: `${progressPct}%` }} />
        </div>
      )}

      {/* Mobile dropdown menu */}
      {isMobile && showMobileMenu && (
        <div style={s.mobileMenuOverlay} onClick={() => setShowMobileMenu(false)}>
          <div style={s.mobileMenu} onClick={e => e.stopPropagation()}>
            {sessionMin > 0 && (
              <div style={s.mobileMenuItem}>
                <span style={s.mobileMenuIcon}>⏱</span>
                <span>{sessionTimerLabel} reading</span>
              </div>
            )}
            <div style={s.mobileMenuDivider} />
            <button style={s.mobileMenuItem} onClick={() => { setShowChapterPicker(v => !v); }}>
              <span style={s.mobileMenuIcon}>☰</span>
              <span>Chapters</span>
              <span style={s.mobileMenuChevron}>{showChapterPicker ? '▴' : '▾'}</span>
            </button>
            {showChapterPicker && toc.length > 0 && (
              <div style={s.chapterList}>
                {toc.map(ch => (
                  <button
                    key={ch.chapter_index}
                    style={{
                      ...s.chapterItem,
                      ...(ch.chapter_index === chapterIndex ? s.chapterItemActive : {}),
                    }}
                    onClick={() => {
                      navigateTo(ch.chapter_index, 0);
                      setShowMobileMenu(false);
                      setShowChapterPicker(false);
                    }}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            )}
            <div style={s.mobileMenuDivider} />
            <button style={s.mobileMenuItem} onClick={() => { copyChapter(); setShowMobileMenu(false); }}>
              <span style={s.mobileMenuIcon}>⧉</span>
              <span>Copy chapter</span>
            </button>
            <button style={s.mobileMenuItem} onClick={() => { exportChapter('md'); setShowMobileMenu(false); }}>
              <span style={s.mobileMenuIcon}>↓</span>
              <span>Export .md</span>
            </button>
            <button style={s.mobileMenuItem} onClick={() => { onReview(); setShowMobileMenu(false); }}>
              <span style={s.mobileMenuIcon}>▣</span>
              <span>Review cards</span>
            </button>
            {sessionId && (
              <button style={{ ...s.mobileMenuItem, color: 'var(--accent-amber)' }} onClick={() => { setShowHarvest(true); setShowMobileMenu(false); }}>
                <span style={s.mobileMenuIcon}>✦</span>
                <span>Harvest session</span>
              </button>
            )}
            <div style={s.mobileMenuDivider} />
            <div style={s.mobileMenuProgress}>
              {progressPct}% · Ch {chapterIndex + 1}/{toc.length || '?'}
            </div>
          </div>
        </div>
      )}

      {/* Break reminder */}
      {showBreakReminder && (
        <div style={s.breakBanner}>
          <span>Retention peaks around 45 min — good time for a break?</span>
          <button style={{ ...s.breakClose, ...(isMobile ? { minWidth: '44px', minHeight: '44px' } : {}) }} onClick={() => setShowBreakReminder(false)}>✕</button>
        </div>
      )}

      {/* Body */}
      <div style={s.body}>
        {!isMobile && (
          <ProgressRibbon toc={toc} chapterIndex={chapterIndex} pageIndex={pageIndex} onNavigate={navigateTo} />
        )}
        {positionReady && (
          <ReaderPane
            bookId={book.id} chapterIndex={chapterIndex} pageIndex={pageIndex}
            onNavigate={navigateTo} annotations={annotations} highlights={highlights}
            onSelectionChange={setSelectionInfo} onWordDoubleClick={handleWordDoubleClick}
            readerSettings={readerSettings}
          />
        )}
        {!isMobile && (
          <div style={{ ...s.marginWrapper, width: panelWidth }}>
            <MarginPanel
              annotations={annotations} activeAnnotationId={activeAnnotationId}
              onBodyBlur={handleBodyBlur} onDelete={handleDeleteAnnotation}
              selectionInfo={selectionInfo} onCreateAnnotation={createAnnotation}
              onCopySelection={handleCopySelection} onHighlight={handleHighlight}
            />
          </div>
        )}
      </div>

      {/* Mobile floating annotation toolbar — appears when text is selected */}
      {isMobile && selectionInfo && !showMobilePanel && (
        <div style={s.floatingToolbar}>
          <div style={s.floatingToolbarInner}>
            {['N', 'Q', 'C'].map(type => {
              const colors = { N: 'var(--accent-blue)', Q: 'var(--accent-amber)', C: 'var(--accent-green)' };
              const labels = { N: 'Note', Q: 'Ask', C: 'Concept' };
              return (
                <button
                  key={type}
                  style={{ ...s.floatingBtn, color: colors[type], borderColor: colors[type] }}
                  onClick={() => createAnnotation(type)}
                >
                  {labels[type]}
                </button>
              );
            })}
            <button
              style={{ ...s.floatingBtn, color: 'var(--highlight)', borderColor: 'var(--highlight)' }}
              onClick={handleHighlight}
            >
              HL
            </button>
            <button
              style={{ ...s.floatingBtn, color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }}
              onClick={handleCopySelection}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom sheet for notes */}
      {isMobile && showMobilePanel && (
        <>
          <div style={s.mobileSheetBackdrop} onClick={() => setShowMobilePanel(false)} />
          <div style={s.mobileSheet}>
            <div style={s.mobileSheetHeader}>
              <div style={s.mobileSheetHandle} />
              <button style={s.mobileSheetClose} onClick={() => setShowMobilePanel(false)}>✕</button>
            </div>
            <MarginPanel
              annotations={annotations} activeAnnotationId={activeAnnotationId}
              onBodyBlur={handleBodyBlur} onDelete={handleDeleteAnnotation}
              selectionInfo={selectionInfo} onCreateAnnotation={createAnnotation}
              onCopySelection={handleCopySelection} onHighlight={handleHighlight}
            />
          </div>
        </>
      )}

      {/* Reader settings panel */}
      {showSettings && (
        <ReaderSettings
          settings={readerSettings}
          onUpdate={updateReaderSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Vocab popup */}
      {vocabPopup && (
        <div style={s.vocabOverlay} onClick={() => setVocabPopup(null)}>
          <div style={s.vocabPopup} onClick={e => e.stopPropagation()}>
            <div style={s.vocabHeader}>
              <span style={s.vocabWord}>{vocabPopup.word}</span>
              <div style={s.vocabLangToggle}>
                {['en', 'it'].map(l => (
                  <button key={l}
                    style={{ ...s.vocabLangBtn, ...(vocabLang === l ? s.vocabLangBtnActive : {}) }}
                    onClick={() => setVocabLang(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {vocabPopup.context && <div style={s.vocabContext}>"{vocabPopup.context}"</div>}
            <input
              style={s.vocabInput}
              placeholder={vocabLang === 'en' ? 'Italian translation…' : 'English translation…'}
              value={vocabTrans}
              onChange={e => setVocabTrans(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveVocabCard(); }}
              autoFocus
            />
            <div style={s.vocabActions}>
              <button style={{ ...s.vocabCancel, minHeight: '44px' }} onClick={() => setVocabPopup(null)}>Cancel</button>
              <button style={{ ...s.vocabSave, minHeight: '44px' }} onClick={saveVocabCard} disabled={vocabSaving}>
                {vocabSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-base)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: '0 var(--space-lg)',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-surface)',
    height: 'var(--topbar-height)',
    flexShrink: 0,
  },
  topBarMobile: {
    height: '48px',
    padding: '0 var(--space-sm)',
    gap: 'var(--space-xs)',
  },
  backBtn: {
    background: 'none',
    color: 'var(--accent-blue)',
    border: 'none',
    fontSize: 'var(--text-sm)',
    padding: '4px 8px',
    flexShrink: 0,
    fontFamily: 'var(--font-ui)',
  },
  touchBtn: {
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    padding: 0,
  },
  bookTitle: {
    flex: 1,
    fontWeight: 600,
    fontSize: 'var(--text-md)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
  },
  bookTitleMobile: {
    fontSize: 'var(--text-sm)',
  },
  timerBadge: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 8px',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  chapterSelect: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    fontSize: 'var(--text-sm)',
    maxWidth: '220px',
    flexShrink: 0,
    fontFamily: 'var(--font-ui)',
  },
  actionGroup: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  toolBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    padding: '3px 10px',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  harvestBtn: {
    background: 'none',
    border: '1px solid var(--accent-amber)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent-amber)',
    padding: '3px 10px',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
  // Mobile icon buttons in top bar
  mobileIconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.1rem',
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
  },
  // Mobile progress bar (thin, under top bar)
  mobileProgress: {
    height: '3px',
    background: 'var(--border-subtle)',
    flexShrink: 0,
  },
  mobileProgressFill: {
    height: '100%',
    background: 'var(--accent-blue)',
    transition: 'width var(--transition-slow)',
  },
  // Mobile dropdown menu
  mobileMenuOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    background: 'rgba(0,0,0,0.3)',
  },
  mobileMenu: {
    position: 'fixed',
    top: '48px',
    right: 0,
    width: '260px',
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '0 0 0 var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 91,
    padding: 'var(--space-xs) 0',
  },
  mobileMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    width: '100%',
    padding: 'var(--space-md) var(--space-lg)',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    textAlign: 'left',
    minHeight: '44px',
  },
  mobileMenuIcon: {
    width: '20px',
    textAlign: 'center',
    flexShrink: 0,
    fontSize: '1rem',
  },
  mobileMenuChevron: {
    marginLeft: 'auto',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-xs)',
  },
  mobileMenuDivider: {
    height: '1px',
    background: 'var(--border-subtle)',
    margin: 'var(--space-xs) var(--space-lg)',
  },
  mobileMenuProgress: {
    padding: 'var(--space-sm) var(--space-lg)',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  chapterList: {
    maxHeight: '240px',
    overflowY: 'auto',
    padding: '0 var(--space-sm)',
  },
  chapterItem: {
    display: 'block',
    width: '100%',
    padding: 'var(--space-sm) var(--space-lg)',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    textAlign: 'left',
    borderRadius: 'var(--radius-sm)',
    minHeight: '40px',
    lineHeight: '1.3',
  },
  chapterItemActive: {
    background: 'var(--accent-blue-muted)',
    color: 'var(--accent-blue)',
    fontWeight: 600,
  },
  breakBanner: {
    background: 'var(--accent-green-muted)',
    borderBottom: '1px solid var(--accent-green-dim)',
    padding: '8px var(--space-2xl)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 'var(--text-sm)',
    color: 'var(--accent-green)',
  },
  breakClose: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-green)',
    opacity: 0.7,
    fontSize: 'var(--text-base)',
    padding: '2px 6px',
    fontFamily: 'var(--font-ui)',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  marginWrapper: {
    borderLeft: '1px solid var(--border-subtle)',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  // Floating annotation toolbar (mobile)
  floatingToolbar: {
    position: 'fixed',
    bottom: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 80,
    animation: 'fadeInUp 150ms ease',
  },
  floatingToolbarInner: {
    display: 'flex',
    gap: '6px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '8px 12px',
    boxShadow: 'var(--shadow-lg)',
  },
  floatingBtn: {
    background: 'transparent',
    border: '1px solid',
    borderRadius: 'var(--radius-md)',
    padding: '8px 14px',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    minHeight: '40px',
    whiteSpace: 'nowrap',
  },
  // Mobile bottom sheet
  mobileSheetBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 99,
  },
  mobileSheet: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    height: '50vh',
    background: 'var(--bg-surface)',
    borderTop: '1px solid var(--border)',
    borderRadius: '14px 14px 0 0',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
  },
  mobileSheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-sm) var(--space-md)',
    position: 'relative',
    flexShrink: 0,
  },
  mobileSheetHandle: {
    width: '40px',
    height: '4px',
    background: 'var(--border-strong)',
    borderRadius: '2px',
  },
  mobileSheetClose: {
    position: 'absolute',
    right: 'var(--space-sm)',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1rem',
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-ui)',
  },
  // Vocab popup
  vocabOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(2px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 'var(--space-lg)',
  },
  vocabPopup: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-xl)',
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    boxShadow: 'var(--shadow-xl)',
  },
  vocabHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-md)',
  },
  vocabWord: { fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' },
  vocabLangToggle: { display: 'flex', gap: '4px' },
  vocabLangBtn: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    padding: '8px 12px',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    minHeight: '44px',
  },
  vocabLangBtnActive: {
    background: 'var(--accent-blue-muted)',
    border: '1px solid var(--accent-blue)',
    color: 'var(--accent-blue)',
  },
  vocabContext: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  vocabInput: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '16px',
    padding: '12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-ui)',
  },
  vocabActions: {
    display: 'flex',
    gap: 'var(--space-sm)',
    justifyContent: 'flex-end',
  },
  vocabCancel: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    padding: '6px 14px',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  vocabSave: {
    background: 'var(--accent-green-dim)',
    border: '1px solid var(--accent-green)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--accent-green)',
    padding: '6px 16px',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
};
