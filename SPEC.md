# DeepReader — Implementation Spec

_Generated from design interview. All decisions recorded here are authoritative._

---

## 1. Project Overview

Local-first EPUB reader for deep learning and retention. No AI, no external APIs. Runs in Docker at `localhost:7070`. Data persists in Docker volumes.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| API server | Express |
| Frontend | React 18 (Vite) |
| DB | SQLite via `better-sqlite3` |
| EPUB parsing | `epub` npm package (server-side only) |
| SRS | SM-2 (custom pure function, no library) |
| Output | Markdown + YAML frontmatter |
| Deployment | Docker, `localhost:7070` |

---

## 3. Docker / Infrastructure

### Volume layout
```
/data/
  library/    ← EPUB files (UUID-named)
  vault/      ← Obsidian-compatible Markdown cards
```

### Container user
- Non-root, fixed UID/GID 1000
- User name: `deepreader`
- Host must run once: `chown -R 1000:1000 ./data`

### Dockerfile skeleton
```dockerfile
FROM node:20-alpine
RUN addgroup -S deepreader && adduser -S -u 1000 -G deepreader deepreader
WORKDIR /app
COPY . .
RUN npm ci --workspaces
RUN npm run build
USER deepreader
EXPOSE 7070
CMD ["node", "server/index.js"]
```

### docker-compose.yml
```yaml
services:
  deepreader:
    build: .
    ports:
      - "7070:7070"
    volumes:
      - ./data:/data
    environment:
      - NODE_ENV=production
```

---

## 4. Monorepo Layout

```
/
├── package.json          ← npm workspaces root
├── server/               ← Express API + SQLite + SM-2
│   ├── index.js
│   ├── db/
│   │   └── migrations/   ← one .js file per feature
│   ├── routes/
│   └── lib/
│       └── sm2.js
├── client/               ← React 18 (Vite)
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       └── components/
├── data/                 ← gitignored, Docker volume mount point
│   ├── library/
│   └── vault/
├── Dockerfile
├── docker-compose.yml
├── CLAUDE.md
└── SPEC.md
```

---

## 5. SQLite Schema

### Migration strategy
Each feature co-locates its migration in `server/db/migrations/`. Migrations run in filename-sorted order on startup via a simple runner.

### Tables

#### `books`
```sql
CREATE TABLE books (
  id          TEXT PRIMARY KEY,          -- UUID
  filename    TEXT NOT NULL,             -- UUID.epub in /data/library
  title       TEXT,
  author      TEXT,
  cover_path  TEXT,
  chapter_count INTEGER,
  imported_at TEXT NOT NULL              -- ISO 8601
);
```

#### `pages`
```sql
CREATE TABLE pages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  page_index    INTEGER NOT NULL,
  para_start    INTEGER NOT NULL,        -- first paragraph index in chapter
  para_end      INTEGER NOT NULL,        -- last paragraph index (inclusive)
  UNIQUE(book_id, chapter_index, page_index)
);
```

#### `sessions`
```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,          -- UUID
  book_id     TEXT NOT NULL REFERENCES books(id),
  started_at  TEXT NOT NULL,             -- ISO 8601
  last_active TEXT NOT NULL,             -- ISO 8601, updated on any annotation write
  ended_at    TEXT                       -- NULL while active
);
```

#### `annotations`
```sql
CREATE TABLE annotations (
  id              TEXT PRIMARY KEY,      -- UUID
  book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL REFERENCES sessions(id),
  chapter_index   INTEGER NOT NULL,
  page_index      INTEGER NOT NULL,
  paragraph_index INTEGER NOT NULL,      -- start paragraph
  char_offset     INTEGER NOT NULL,      -- char offset within start paragraph
  selected_text   TEXT NOT NULL,         -- raw selected string (fuzzy re-anchor)
  type            TEXT NOT NULL          -- 'N' | 'Q' | 'C'
    CHECK(type IN ('N','Q','C')),
  body            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL
);
```

#### `concept_cards`
```sql
CREATE TABLE concept_cards (
  id            TEXT PRIMARY KEY,        -- UUID
  annotation_id TEXT REFERENCES annotations(id),
  title         TEXT NOT NULL,
  source_book   TEXT NOT NULL,           -- book title
  source_page   TEXT NOT NULL,           -- "ch{N} p{M}"
  body          TEXT NOT NULL,           -- Markdown with {{c1::mask}} syntax
  tags          TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  linked_concepts TEXT NOT NULL DEFAULT '[]', -- JSON array of [[wiki-link]] targets
  srs_interval  INTEGER NOT NULL DEFAULT 1,
  srs_efactor   REAL NOT NULL DEFAULT 2.5,
  srs_due       TEXT NOT NULL,           -- ISO 8601 date
  created_at    TEXT NOT NULL,
  vault_path    TEXT NOT NULL            -- absolute path written to /data/vault
);
```

---

## 6. EPUB Rendering & Pagination

### Approach: paragraph-boundary chunking (server-side, at import time)

1. Parse EPUB with `epub` package, extract chapters as HTML strings.
2. For each chapter, parse HTML paragraphs (`<p>`, `<div>`, etc.) into an ordered list.
3. Group consecutive paragraphs until the accumulated character count exceeds **`PAGE_SIZE = 3000` chars**. Each group = one page.
4. Store page records in `pages` table with `para_start` and `para_end`.
5. Page HTML is **reconstructed on demand** by slicing the chapter paragraph list — not stored in DB (saves space, always fresh).

### API endpoints
```
GET /api/books/:id/pages?chapter=N&page=M
  → { html: "<p>...</p><p>...</p>", total_pages: K, chapter_count: C }

GET /api/books/:id/toc
  → [ { chapter_index, title, page_count } ]
```

### Stability guarantee
Page addresses `(chapter_index, page_index)` are immutable after import. If the book is re-imported it gets a new UUID.

---

## 7. React Component Tree

```
App
├── LibraryView              ← book grid, upload button, delete button
└── ReaderView
    ├── ReaderPane            ← renders page HTML, handles text selection
    │   ├── PageRenderer      ← dangerouslySetInnerHTML + selection listener
    │   └── AnnotationPins    ← ⊕ icons overlaid at paragraph vertical positions
    ├── DividerHandle         ← drag to resize; width stored in localStorage
    └── MarginPanel           ← right panel, always visible
        ├── NoteEditor        ← active note being written (N/Q/C tabs)
        └── NoteList          ← scrollable list of annotations on current page
```

### Layout
- Horizontal flexbox: `[ReaderPane][DividerHandle][MarginPanel]`
- Default split: `calc(100% - 360px)` reader / `360px` panel
- Drag divider updates CSS variable `--panel-width`; persisted to `localStorage`
- No responsive / mobile behavior

### Keyboard shortcuts
| Key | Action |
|---|---|
| `Alt+N` | New Note annotation |
| `Alt+Q` | New Question annotation |
| `Alt+C` | New Concept annotation |
| `←` / `→` arrow keys | Previous / next page |
| `Ctrl+H` | Cloze-mask selected text |

---

## 8. Annotation Flow

1. User selects text in `PageRenderer`.
2. `selectionchange` event fires; selection is captured.
3. User presses `Alt+N`, `Alt+Q`, or `Alt+C` (or clicks a button).
4. Client calls `POST /api/annotations` with:
   - `book_id`, `session_id`
   - `chapter_index`, `page_index`
   - `paragraph_index` (index of start paragraph within chapter)
   - `char_offset` (char offset within that paragraph's text)
   - `selected_text` (raw string)
   - `type` ('N'|'Q'|'C')
5. Annotation pin `⊕` appears at the vertical midpoint of the start paragraph.
6. `MarginPanel` shows the new note with an editable body field.
7. Body is saved on blur via `PATCH /api/annotations/:id`.

### Multi-paragraph selections
Only the **start anchor** is stored: `(paragraph_index, char_offset, selected_text)`. On reload, the selected text is located by fuzzy search near the anchor to re-highlight.

---

## 9. Session Management

- On app load (or first annotation of a day), check `localStorage` for `active_session_id`.
- If none or the stored session's `last_active` is > 30 minutes ago, create a new session via `POST /api/sessions`.
- On every annotation write, call `PATCH /api/sessions/:id/touch` to update `last_active`.
- Session ends automatically (marked `ended_at = now`) when idle > 30 min, detected server-side on the next `touch` call.
- Session Harvest is accessible via `GET /api/sessions/:id/harvest` → all annotations in that session.

---

## 10. SM-2 Algorithm

### Pure function signature
```js
// server/lib/sm2.js
function sm2(card, rating) {
  // card: { interval, efactor }
  // rating: integer 1–5
  // returns: { new_interval, new_efactor, due_date }
}
```

### Algorithm
```
if rating >= 3:
  if interval == 1:   new_interval = 1
  elif interval == 2: new_interval = 6
  else:               new_interval = round(interval * efactor)
  new_efactor = efactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  new_efactor = max(1.3, new_efactor)
else:                 // rating < 3 → forgot
  new_interval = 1
  new_efactor = max(1.3, efactor - 0.2)

due_date = today + new_interval days
```

### New card defaults
```
interval  = 1
efactor   = 2.5
due_date  = today (immediately reviewable)
```

### Unit test coverage required (before implementation)
- rating 1,2 → interval=1, efactor decreases by 0.2, floor at 1.3
- rating 3,4,5 → interval grows correctly
- EFactor never drops below 1.3
- EFactor never exceeds ~3.0 after many 5-ratings
- New card first review at each rating value

---

## 11. Cloze Mechanic

### Model: one cloze per card
- User selects text in `PageRenderer` while editing/reviewing a card, then presses `Ctrl+H`.
- Selected text is replaced in the card body with `{{c1::original text}}`.
- One card = one `{{c1::...}}` mask. If the user presses `Ctrl+H` again, it creates a **new card**.

### Review flow
1. `ReviewSession` component shows card body with `{{c1::...}}` replaced by `_____`.
2. User types their answer in a text input.
3. User clicks "Reveal" → answer shown, original text revealed.
4. User self-rates 1–5.
5. `sm2()` is called, card updated via `PATCH /api/concept_cards/:id/review`.

---

## 12. Book Management API

```
POST   /api/books/upload          ← multipart, saves UUID.epub to /data/library
GET    /api/books                 ← list all books
GET    /api/books/:id             ← book metadata + chapter list
DELETE /api/books/:id             ← deletes EPUB file, DB record, cascades annotations
```

### Delete behavior
- Deletes `/data/library/<uuid>.epub`
- Cascades in SQLite: annotations, pages, sessions for that book
- Does **not** delete vault `.md` files (they are standalone Obsidian notes)

---

## 13. Session Harvest & Obsidian Export

### Harvest screen
- Shown after a session ends or triggered manually.
- Lists all annotations from the session grouped by page.
- Each annotation has a "Promote to Card" button.

### Promote-to-card flow
1. Client calls `POST /api/concept_cards` with annotation_id + title + tags.
2. Server creates `concept_cards` record.
3. Server writes Markdown file to `/data/vault/<sanitized-title>.md`.

### Filename collision
- Try `<sanitized-title>.md`.
- If exists, try `<sanitized-title>-2.md`, `<sanitized-title>-3.md`, etc.

### Markdown file format
```markdown
---
id: <uuid>
title: <title>
source_book: <book title>
source_page: "ch2 p5"
created: 2026-03-24
srs_due: 2026-03-24
srs_interval: 1
srs_efactor: 2.5
tags: []
linked_concepts: []
---

<card body with {{c1::mask}} syntax>
```

### Wiki-link indexing
- After writing the file, server parses `[[...]]` patterns in the card body.
- Targets stored in `concept_cards.linked_concepts` JSON array.
- Used later for a graph/backlink view (future feature, schema is ready now).

---

## 14. API Surface (complete)

```
# Health
GET  /api/health

# Books
POST   /api/books/upload
GET    /api/books
GET    /api/books/:id
DELETE /api/books/:id

# Pages
GET  /api/books/:id/pages?chapter=N&page=M
GET  /api/books/:id/toc

# Sessions
POST   /api/sessions
PATCH  /api/sessions/:id/touch
GET    /api/sessions/:id/harvest

# Annotations
POST   /api/annotations
GET    /api/annotations?book_id=X&chapter=N&page=M
PATCH  /api/annotations/:id
DELETE /api/annotations/:id

# Concept Cards
POST   /api/concept_cards
GET    /api/concept_cards?due=true
GET    /api/concept_cards/:id
PATCH  /api/concept_cards/:id/review
DELETE /api/concept_cards/:id
```

---

## 15. Implementation Phases

| Session | Scope |
|---|---|
| **A** | Scaffold: Dockerfile, docker-compose, Express skeleton, Vite+React skeleton, SQLite migration runner, health endpoint |
| **B** | EPUB import (upload + parse + paginate), `ReaderPane`, page navigation, progress ribbon |
| **C** | Annotation layer: text selection, pins, `MarginPanel`, N/Q/C types, keyboard shortcuts, SQLite persistence |
| **D** | SM-2 engine (unit-tested first), cloze mechanic, `ReviewSession` component, due-date view |
| **E** | Session Harvest screen, Promote-to-card, Obsidian `.md` output, wiki-link indexing |
