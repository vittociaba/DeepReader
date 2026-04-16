# DeepReader — CLAUDE.md

## Stack
- Runtime: Node.js 20 LTS + Express
- Frontend: React 18 (Vite)
- DB: SQLite via better-sqlite3
- EPUB rendering: epub.js (server-side)
- SRS: SM-2 algorithm (deterministic, no AI)
- Output: Markdown + YAML frontmatter (Obsidian-compatible)
- Deployment: Docker, served at localhost:7070

## Constraints (NON-NEGOTIABLE)
- Zero AI, zero ML, zero external API calls
- All data stored in /data/library (epubs) and /data/vault (markdown)
- Annotation schema: (chapter_index, page_index, paragraph_index, char_offset)
- SRS intervals stored in YAML frontmatter of each Concept Card
- Every card must be a valid standalone Obsidian note

## Build commands
- npm run dev    — local dev server
- npm run build  — production build
- npm test       — run test suite

## Architecture
- /server        — Express API, sqlite, SM-2 logic
- /client        — React frontend
- /data          — docker volume mount point

## Database
- After making database/model changes, always run migrations and verify they apply cleanly.
- Check for duplicate migration revisions before creating new ones.

## Feature Removal Checklist
- When removing features (quests, tabs, components), also clean up related database records, cached state, and localStorage — not just code references.

## Verification
- After making changes, always verify the app builds successfully and the dev server starts before reporting completion.
- Kill any orphaned processes on common ports (7070, 3000, 5173) first.

## Debugging Guidelines
- When a fix attempt doesn't work and the user reports it's still broken, step back and reconsider the approach rather than iterating on the same strategy.
- After 2 failed attempts with the same technique, try a fundamentally different approach.

## Code Quality
- This project uses JavaScript (primary), Python, and TypeScript.
- When editing JS/TS files, ensure all imports are used and no lint errors are introduced.
- Run the linter before finishing.

## Rules
- Never modify the SM-2 algorithm without explicit instruction
- Never introduce any HTTP call to an external service
- Always co-locate the SQLite schema migration with the feature that needs it
```

`CLAUDE.md` files are loaded hierarchically: global (`~/.claude/CLAUDE.md`) applies to all projects, project-level overrides that.  For DeepReader, project-level is sufficient.

---

### Step 2 — The interview prompt (before writing any code)

For larger features, have Claude interview you first. Start with a minimal prompt and ask Claude to interview you using the `AskUserQuestion` tool. Once the spec is complete, start a fresh session to execute it — the new session has clean context focused entirely on implementation. 

Use this prompt verbatim to open the first session:
```
I want to build DeepReader, a local-first EPUB reader for deep learning and retention.
Read @CLAUDE.md for the full project constraints.

Interview me using the AskUserQuestion tool. Focus on:
- Docker volume structure and file permissions
- SQLite schema for annotations and SRS cards
- epub.js server-side rendering approach and pagination model
- React component tree for the reader + margin panel layout
- SM-2 implementation edge cases (new cards, reset behavior)

Don't ask obvious questions. Dig into the hard parts.
Keep interviewing until we've covered everything, then write a complete
implementation plan to SPEC.md. Do not write any code yet.
```

---

### Step 3 — Session-per-phase execution

After the spec is in `SPEC.md`, execute one phase per Claude Code session. Once the spec is complete, start a fresh session to execute it — the new session has clean context focused entirely on implementation. 

**Session A — Scaffold + Docker**
```
Read @CLAUDE.md and @SPEC.md.
Task: Scaffold the full project structure.
- Dockerfile + docker-compose.yml (Node 20, volume mounts at /data)
- Express server skeleton with health endpoint
- Vite+React client skeleton
- SQLite schema migration for: books, annotations, concept_cards
- npm workspaces or monorepo layout
Do not implement any feature logic yet. Just the skeleton.
Run the build and confirm it starts at localhost:7070.
```

**Session B — EPUB rendering + pagination**
```
Read @CLAUDE.md and @SPEC.md.
Context: Scaffold is complete. @./server/index.js @./client/src/App.jsx
Task: Implement fixed-page EPUB rendering.
- epub.js loaded server-side, pages pre-rendered to stable HTML chunks
- Each page assigned immutable (chapter_index, page_index)
- React ReaderPane component: lateral page turns only, no scroll
- Progress ribbon component: vertical strip, colored ticks at annotated pages
Run the dev server and confirm a sample epub renders with stable pagination.
```

**Session C — Annotation layer**
```
Read @CLAUDE.md and @SPEC.md.
Context: Reader renders pages. @./client/src/components/ReaderPane.jsx
Task: Implement the marginalia system.
- Text selection → inline anchor pin (⊕) at correct vertical position
- MarginPanel component: permanent right-panel, 3 note types (N/Q/C)
- Alt+N, Alt+Q, Alt+C keyboard shortcuts
- SQLite persistence: annotations table with (book_id, chapter_index,
  page_index, paragraph_index, char_offset, type, body)
Write integration tests for annotation create/read/delete before implementing.
```

**Session D — SM-2 + SRS review loop**
```
Read @CLAUDE.md and @SPEC.md.
Task: Implement SM-2 spaced repetition engine.
- Pure function: sm2(card, rating) → {new_interval, new_efactor, due_date}
- No external library. Implement from the algorithm spec in SPEC.md.
- Cloze mechanic: Ctrl+H hides selected text, stores as JSON mask in card body
- ReviewSession component: shows cloze card, user types answer, reveals, self-rates 1-5
- Due-date calendar view
Write unit tests for sm2() covering all rating values and EFactor boundaries first.
```

**Session E — Session Harvest + Obsidian export**
```
Read @CLAUDE.md and @SPEC.md.
Task: Implement Session Harvest and Concept Card output.
- Post-session screen listing all annotations from the current session
- Promote-to-card mechanic → writes Markdown file with YAML frontmatter
- YAML must include: id, title, source_book, source_page, created,
  srs_due, srs_interval, srs_efactor, tags, linked_concepts
- [[wiki-link]] syntax in card body parsed and indexed in SQLite
- Output path: /data/vault/<sanitized-title>.md
Verify output is valid Obsidian note by checking frontmatter parsing.
```

---

### Step 4 — Context management during long sessions

Two patterns to prevent context collapse:

**Handoff document** — when a session runs long, before `/clear`:
```
Before we continue: write a HANDOFF.md to /docs.
Include: what's been implemented, what's broken, what the next session
should start with, and which files changed. The next agent will have
zero other context.