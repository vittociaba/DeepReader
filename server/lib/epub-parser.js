const { EPub } = require('epub');
const { parse: parseHtml } = require('node-html-parser');

const PAGE_SIZE = 3000; // characters per page

// In-memory cache: bookId -> { epub, chapters: Map<chapterIndex, paragraph[]> }
const epubCache = new Map();

// ---------- low-level epub helpers ----------

async function openEpub(filepath) {
  const epub = new EPub(filepath);
  await epub.parse();
  return epub;
}

async function getChapterHtml(epub, chapterId) {
  return (await epub.getChapter(chapterId)) || '';
}

// ---------- paragraph extraction ----------

/**
 * Given chapter HTML, returns an ordered array of { html, text } objects —
 * one entry per visible block element (<p>, headings).
 */
function extractParagraphs(html) {
  try {
    const root = parseHtml(html);
    let blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6');

    if (blocks.length === 0) {
      const text = root.text.trim();
      if (text.length > 0) return [{ html: `<p>${text}</p>`, text }];
      return [];
    }

    return blocks
      .map(el => ({ html: el.outerHTML, text: el.text }))
      .filter(p => p.text.trim().length > 0);
  } catch (_) {
    return [];
  }
}

// ---------- page chunking ----------

/**
 * Groups paragraphs into page-sized chunks (by char count).
 * Returns array of { para_start, para_end } index ranges (inclusive).
 */
function chunkIntoPages(paragraphs) {
  if (paragraphs.length === 0) return [];

  const pages = [];
  let start = 0;
  let charCount = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    charCount += paragraphs[i].text.length;
    const isLast = i === paragraphs.length - 1;
    if (charCount >= PAGE_SIZE || isLast) {
      pages.push({ para_start: start, para_end: i });
      start = i + 1;
      charCount = 0;
    }
  }

  return pages;
}

// ---------- cache helpers ----------

async function getOrLoadEpub(epubPath, bookId) {
  if (!epubCache.has(bookId)) {
    const epub = await openEpub(epubPath);
    epubCache.set(bookId, { epub, chapters: new Map() });
  }
  return epubCache.get(bookId).epub;
}

async function getChapterParagraphs(epubPath, bookId, chapterIndex) {
  const epub = await getOrLoadEpub(epubPath, bookId);
  const cached = epubCache.get(bookId);

  if (!cached.chapters.has(chapterIndex)) {
    const chapter = epub.flow[chapterIndex];
    if (!chapter) {
      cached.chapters.set(chapterIndex, []);
    } else {
      try {
        const html = await getChapterHtml(epub, chapter.id);
        cached.chapters.set(chapterIndex, extractParagraphs(html));
      } catch (_) {
        cached.chapters.set(chapterIndex, []);
      }
    }
  }

  return cached.chapters.get(chapterIndex);
}

function invalidateCache(bookId) {
  epubCache.delete(bookId);
}

// ---------- public API ----------

/**
 * Parses an EPUB file, inserts page records into SQLite, caches paragraphs.
 * Returns { title, author, chapterCount }.
 */
async function parseAndPaginate(epubPath, bookId, db) {
  const epub = await openEpub(epubPath);
  // Pre-populate cache so subsequent page requests are fast
  epubCache.set(bookId, { epub, chapters: new Map() });

  const insertPage = db.prepare(
    'INSERT OR IGNORE INTO pages (book_id, chapter_index, page_index, para_start, para_end) VALUES (?, ?, ?, ?, ?)'
  );

  const chapters = epub.flow;

  for (let ci = 0; ci < chapters.length; ci++) {
    let html = '';
    try {
      html = await getChapterHtml(epub, chapters[ci].id);
    } catch (_) {
      continue;
    }

    const paragraphs = extractParagraphs(html);
    epubCache.get(bookId).chapters.set(ci, paragraphs);

    if (paragraphs.length === 0) continue;

    const pageChunks = chunkIntoPages(paragraphs);
    for (let pi = 0; pi < pageChunks.length; pi++) {
      insertPage.run(bookId, ci, pi, pageChunks[pi].para_start, pageChunks[pi].para_end);
    }
  }

  return {
    title: epub.metadata.title || 'Unknown Title',
    author: epub.metadata.creator || 'Unknown Author',
    chapterCount: chapters.length,
  };
}

/**
 * Returns { html, total_pages, chapter_count } for the given page address.
 */
async function getPageData(epubPath, bookId, chapterIndex, pageIndex, db) {
  const page = db.prepare(
    'SELECT para_start, para_end FROM pages WHERE book_id = ? AND chapter_index = ? AND page_index = ?'
  ).get(bookId, chapterIndex, pageIndex);

  if (!page) return null;

  const paragraphs = await getChapterParagraphs(epubPath, bookId, chapterIndex);
  const html = paragraphs
    .slice(page.para_start, page.para_end + 1)
    .map((p, i) => {
      // Inject data-para-index (chapter-relative) so the client can anchor pins
      const absIdx = page.para_start + i;
      return p.html.replace(/^(<[a-zA-Z][^\s/>]*)/, `$1 data-para-index="${absIdx}"`);
    })
    .join('\n');

  const { n: totalPages } = db.prepare(
    'SELECT COUNT(*) as n FROM pages WHERE book_id = ? AND chapter_index = ?'
  ).get(bookId, chapterIndex);

  const { n: chapterCount } = db.prepare(
    'SELECT COUNT(DISTINCT chapter_index) as n FROM pages WHERE book_id = ?'
  ).get(bookId);

  return { html, total_pages: totalPages, chapter_count: chapterCount };
}

/**
 * Returns TOC array: [{ chapter_index, title, page_count }]
 */
async function getToc(epubPath, bookId, db) {
  const epub = await getOrLoadEpub(epubPath, bookId);

  return epub.flow.map((chapter, ci) => {
    const { n } = db.prepare(
      'SELECT COUNT(*) as n FROM pages WHERE book_id = ? AND chapter_index = ?'
    ).get(bookId, ci);
    return {
      chapter_index: ci,
      title: chapter.title || `Chapter ${ci + 1}`,
      page_count: n,
    };
  });
}

/**
 * Returns full plain text of a chapter (all paragraphs joined with double newlines).
 */
async function getChapterText(epubPath, bookId, chapterIndex) {
  const paragraphs = await getChapterParagraphs(epubPath, bookId, chapterIndex);
  return paragraphs.map(p => p.text.trim()).filter(Boolean).join('\n\n');
}

/**
 * Returns the full chapter as a single HTML string with data-para-index on each block.
 * Used by client-side CSS-column pagination.
 */
async function getChapterHtmlContent(epubPath, bookId, chapterIndex) {
  const paragraphs = await getChapterParagraphs(epubPath, bookId, chapterIndex);
  const html = paragraphs
    .map((p, i) => p.html.replace(/^(<[a-zA-Z][^\s/>]*)/, `$1 data-para-index="${i}"`))
    .join('\n');
  return { html, paragraph_count: paragraphs.length };
}

module.exports = { parseAndPaginate, getPageData, getToc, getChapterText, getChapterHtmlContent, invalidateCache };
