import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSwipe } from '../hooks/useSwipe';
import { useIsMobile } from '../hooks/useIsMobile';
import { READER_THEMES, FONT_FAMILIES } from '../hooks/useReaderSettings';

function getTextNodeAtOffset(el, targetOffset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node;
  while ((node = walker.nextNode())) {
    const len = node.length;
    if (offset + len >= targetOffset) return { node, offset: targetOffset - offset };
    offset += len;
  }
  return null;
}

function applyHighlightRange(paraEl, charOffset, length) {
  if (length <= 0) return;
  const start = getTextNodeAtOffset(paraEl, charOffset);
  const end = getTextNodeAtOffset(paraEl, charOffset + length);
  if (!start || !end) return;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const mark = document.createElement('mark');
  mark.style.cssText = 'background:var(--highlight);color:var(--bg-deep);border-radius:2px;padding:0 1px;';
  try { range.surroundContents(mark); } catch (_) {}
}

function findParaElement(node) {
  let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (el) {
    if (el.dataset && el.dataset.paraIndex !== undefined) return el;
    el = el.parentElement;
  }
  return null;
}

function calcCharOffset(paraEl, startContainer, startOffset) {
  const range = document.createRange();
  range.setStart(paraEl, 0);
  range.setEnd(startContainer, startOffset);
  return range.toString().length;
}

function getSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const selectedText = sel.toString().trim();
  if (!selectedText) return null;
  const range = sel.getRangeAt(0);
  const paraEl = findParaElement(range.startContainer);
  if (!paraEl) return null;
  const paragraphIndex = parseInt(paraEl.dataset.paraIndex, 10);
  const charOffset = calcCharOffset(paraEl, range.startContainer, range.startOffset);
  return { paragraphIndex, charOffset, selectedText };
}

// Cache chapter HTML to avoid re-fetching
const chapterCache = new Map();
const MAX_CACHE = 10;

export default function ReaderPane({
  bookId, chapterIndex, pageIndex, onNavigate,
  annotations, highlights, onSelectionChange, onWordDoubleClick,
  readerSettings,
}) {
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const isMobile = useIsMobile();

  const containerRef = useRef();
  const columnRef = useRef();
  const textRef = useRef();

  const theme = READER_THEMES[readerSettings?.theme] || READER_THEMES.sepia;
  const fontFamily = FONT_FAMILIES[readerSettings?.fontFamily] || FONT_FAMILIES.serif;
  const fontSize = `${(readerSettings?.fontSize || 105) / 100}rem`;
  const lineHeight = (readerSettings?.lineHeight || 190) / 100;

  // Load entire chapter HTML
  useEffect(() => {
    setLoading(true);
    setError(null);

    const cacheKey = `${bookId}:${chapterIndex}`;
    const cached = chapterCache.get(cacheKey);
    if (cached) {
      setChapterData(cached);
      setLoading(false);
      return;
    }

    fetch(`/api/books/${bookId}/chapter/${chapterIndex}/html`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setChapterData(data);
        chapterCache.set(cacheKey, data);
        if (chapterCache.size > MAX_CACHE) {
          const first = chapterCache.keys().next().value;
          chapterCache.delete(first);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookId, chapterIndex]);

  // Render HTML + highlights into the text element
  useEffect(() => {
    if (!textRef.current || !chapterData) return;
    textRef.current.innerHTML = chapterData.html;
    if (!highlights || highlights.length === 0) return;
    for (const hl of highlights) {
      const paraEl = textRef.current.querySelector(`[data-para-index="${hl.paragraph_index}"]`);
      if (paraEl) applyHighlightRange(paraEl, hl.char_offset, hl.length);
    }
  }, [highlights, chapterData]);

  // Calculate total pages from CSS columns after render
  const recalcPages = useCallback(() => {
    if (!columnRef.current || !containerRef.current) return;
    const col = columnRef.current;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) return;
    // scrollWidth includes all columns; divide by one column width (= container width + gap)
    // CSS column-gap is set to containerWidth, so each column+gap = containerWidth * 2
    // But we use column-gap = containerWidth, so total width per "page" = containerWidth (content) + containerWidth (gap) = 2 * containerWidth
    // Actually with CSS columns, scrollWidth = N * (columnWidth + columnGap) - columnGap
    // With columnWidth = containerWidth and columnGap = containerWidth:
    // scrollWidth = N * 2 * containerWidth - containerWidth
    // N = (scrollWidth + containerWidth) / (2 * containerWidth)
    // Simpler: just count how many columns fit
    const scrollW = col.scrollWidth;
    const colWidth = containerWidth;
    const gap = containerWidth; // we set gap = 100% of container width to create spacing
    const pages = Math.max(1, Math.round((scrollW + gap) / (colWidth + gap)));
    setTotalPages(pages);
  }, []);

  // Recalculate pages when content or settings change
  useEffect(() => {
    if (!chapterData) return;
    // Wait for rendering
    const timer = setTimeout(recalcPages, 50);
    return () => clearTimeout(timer);
  }, [chapterData, recalcPages, fontSize, fontFamily, lineHeight, isMobile]);

  // Also recalc on window resize
  useEffect(() => {
    const handler = () => recalcPages();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [recalcPages]);

  const handleDoubleClick = useCallback((e) => {
    if (!onWordDoubleClick) return;
    const sel = window.getSelection();
    const word = sel ? sel.toString().trim() : '';
    if (!word || word.includes(' ') || word.length > 60) return;
    const paraEl = findParaElement(e.target);
    const paraText = paraEl ? paraEl.textContent : '';
    let context = '';
    if (paraText) {
      const idx = paraText.indexOf(word);
      if (idx >= 0) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(paraText.length, idx + word.length + 80);
        context = (start > 0 ? '…' : '') + paraText.slice(start, end).trim() + (end < paraText.length ? '…' : '');
      }
    }
    onWordDoubleClick({ word, context });
  }, [onWordDoubleClick]);

  const handleMouseUp = useCallback(() => {
    setTimeout(() => { onSelectionChange(getSelectionInfo()); }, 50);
  }, [onSelectionChange]);

  const handleMouseDown = useCallback(() => {
    onSelectionChange(null);
  }, [onSelectionChange]);

  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex >= totalPages - 1;
  const isFirstChapter = chapterIndex === 0;
  const isLastChapter = chapterData && chapterIndex >= chapterData.chapter_count - 1;
  const isFirst = isFirstChapter && isFirstPage;
  const isLast = isLastChapter && isLastPage;

  const goToPrev = useCallback(() => {
    onSelectionChange(null);
    if (pageIndex > 0) {
      onNavigate(chapterIndex, pageIndex - 1);
    } else if (chapterIndex > 0) {
      // Go to last page of previous chapter — use -1 as sentinel
      onNavigate(chapterIndex - 1, -1);
    }
  }, [chapterIndex, pageIndex, onNavigate, onSelectionChange]);

  const goToNext = useCallback(() => {
    onSelectionChange(null);
    if (pageIndex < totalPages - 1) {
      onNavigate(chapterIndex, pageIndex + 1);
    } else if (!isLastChapter) {
      onNavigate(chapterIndex + 1, 0);
    }
  }, [chapterIndex, pageIndex, totalPages, isLastChapter, onNavigate, onSelectionChange]);

  // Swipe gestures
  const swipeHandlers = useSwipe({
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  // Tap zones for mobile
  const handleTapNavigation = useCallback((e) => {
    if (!isMobile) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) return;
    if (e.target.closest('button, a, input, textarea, select')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = x / rect.width;
    if (zone < 0.25 && !isFirst) goToPrev();
    else if (zone > 0.75 && !isLast) goToNext();
  }, [isMobile, isFirst, isLast, goToPrev, goToNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToPrev, goToNext]);

  // When page_index is -1 (go-to-last sentinel from previous chapter nav), resolve to last page
  useEffect(() => {
    if (pageIndex === -1 && totalPages > 0) {
      onNavigate(chapterIndex, totalPages - 1);
    }
  }, [pageIndex, totalPages, chapterIndex, onNavigate]);

  // Column translate for current page
  const translateX = useMemo(() => {
    if (!containerRef.current || pageIndex < 0) return 0;
    const w = containerRef.current.clientWidth || 0;
    // Each "page" in CSS columns occupies: columnWidth + columnGap = w + w = 2w
    // Except the first page starts at 0
    return pageIndex * w * 2;
  }, [pageIndex, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  const containerStyle = useMemo(() => ({
    ...s.container,
    background: theme.bg,
    color: theme.text,
  }), [theme.bg, theme.text]);

  const columnStyle = useMemo(() => {
    const w = containerRef.current?.clientWidth || 0;
    return {
      ...s.columnContainer,
      fontFamily,
      fontSize,
      lineHeight,
      color: theme.text,
      columnWidth: `${w}px`,
      columnGap: `${w}px`,
      transform: `translateX(-${translateX}px)`,
    };
  }, [fontFamily, fontSize, lineHeight, theme.text, translateX]);

  const navBarStyle = useMemo(() => ({
    ...s.navBar,
    ...(isMobile ? s.navBarMobile : {}),
    background: theme.navBg,
    borderTopColor: theme.border,
  }), [isMobile, theme.navBg, theme.border]);

  const navBtnStyle = useMemo(() => ({
    ...s.navBtn,
    ...(isMobile ? s.navBtnMobile : {}),
    borderColor: theme.border,
    color: theme.text,
    opacity: 0.6,
  }), [isMobile, theme.border, theme.text]);

  const progress = `${Math.min(pageIndex + 1, totalPages)} / ${totalPages}`;

  return (
    <div
      style={containerStyle}
      {...swipeHandlers}
      onClick={handleTapNavigation}
    >
      {loading && <div style={s.center}>Loading…</div>}
      {error && <div style={{ ...s.center, color: 'var(--accent-red)' }}>Error: {error}</div>}

      {chapterData && !loading && (
        <>
          <div
            style={{ ...s.viewport, ...(isMobile ? s.viewportMobile : {}) }}
            ref={containerRef}
          >
            <div style={columnStyle} ref={columnRef}>
              <div
                ref={textRef}
                dangerouslySetInnerHTML={{ __html: chapterData.html }}
                onMouseUp={handleMouseUp}
                onMouseDown={handleMouseDown}
                onTouchEnd={handleMouseUp}
                onDoubleClick={handleDoubleClick}
              />
            </div>
          </div>

          <div style={navBarStyle}>
            <button style={navBtnStyle} onClick={goToPrev} disabled={isFirst}>←</button>
            <span style={{ ...s.pageInfo, color: theme.text, opacity: 0.5 }}>
              Ch {chapterIndex + 1} · p {progress}
            </span>
            <button style={navBtnStyle} onClick={goToNext} disabled={!!isLast}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#f7f2ea',
    color: '#2a2420',
    touchAction: 'pan-y',
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: 'var(--text-base)',
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
    padding: '2rem 3rem',
    boxSizing: 'border-box',
    position: 'relative',
  },
  viewportMobile: {
    padding: '1rem',
  },
  columnContainer: {
    columnFill: 'auto',
    height: '100%',
    transition: 'transform 200ms ease',
    willChange: 'transform',
  },
  navBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2xl)',
    padding: 'var(--space-md) var(--space-lg)',
    borderTop: '1px solid #e0d8cc',
    background: '#f0ebe3',
    flexShrink: 0,
  },
  navBarMobile: {
    padding: 'var(--space-sm) var(--space-md)',
    gap: 'var(--space-lg)',
  },
  navBtn: {
    background: 'none',
    border: '1px solid #c8c0b4',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 18px',
    fontSize: 'var(--text-md)',
    color: '#5a5048',
    fontFamily: 'var(--font-ui)',
  },
  navBtnMobile: {
    minWidth: '48px',
    minHeight: '44px',
    padding: '10px 20px',
    fontSize: '1.1rem',
  },
  pageInfo: {
    fontSize: 'var(--text-sm)',
    color: '#8a8078',
    minWidth: '140px',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
};
