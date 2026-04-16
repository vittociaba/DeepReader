/**
 * vault.js — Obsidian-compatible markdown writer for concept cards.
 *
 * Responsibilities:
 *   - Sanitize titles to safe filenames
 *   - Resolve filename collisions in /data/vault
 *   - Extract [[wiki-link]] targets from card body
 *   - Build + write YAML frontmatter + body to .md file
 *   - Verify the written file has all required frontmatter keys
 */

const fs = require('fs');
const path = require('path');

const VAULT_DIR = process.env.VAULT_DIR ||
  path.join(__dirname, '../../data/vault');

// ─── title → filename ────────────────────────────────────────────────────────

/**
 * Convert a card title to a filesystem-safe base name (no extension).
 * Removes illegal filename characters, collapses whitespace to hyphens.
 */
function sanitizeTitle(title) {
  return (title || 'untitled')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')   // remove chars illegal on Windows/POSIX
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-{2,}/g, '-')          // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')         // strip leading/trailing hyphens
    .slice(0, 100)                    // max length
    || 'untitled';
}

/**
 * Find the first non-colliding .md path for the given sanitized base name.
 * Tries <name>.md, then <name>-2.md, <name>-3.md, …
 */
function findVaultPath(sanitized) {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  let candidate = path.join(VAULT_DIR, `${sanitized}.md`);
  if (!fs.existsSync(candidate)) return candidate;
  let n = 2;
  while (true) {
    candidate = path.join(VAULT_DIR, `${sanitized}-${n}.md`);
    if (!fs.existsSync(candidate)) return candidate;
    n++;
  }
}

// ─── wiki-link extraction ─────────────────────────────────────────────────────

/**
 * Parse [[target]] patterns from a markdown body.
 * Returns a deduplicated array of target strings.
 */
function parseWikiLinks(body) {
  const re = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  const seen = new Set();
  let m;
  while ((m = re.exec(body || '')) !== null) {
    seen.add(m[1].trim());
  }
  return [...seen];
}

// ─── YAML helpers ─────────────────────────────────────────────────────────────

/** Escape a string value for a YAML double-quoted scalar. */
function yamlStr(val) {
  return '"' + String(val ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Format an array for inline YAML: [] or [item1, item2, …] */
function yamlArr(arr) {
  if (!arr || arr.length === 0) return '[]';
  return '[' + arr.map(v => yamlStr(v)).join(', ') + ']';
}

// ─── markdown builder ────────────────────────────────────────────────────────

/**
 * Build the full .md content for a concept card.
 * `card` must have all fields populated (including srs_*, tags, linked_concepts).
 */
function buildMarkdown(card) {
  const tags = safeParse(card.tags, []);
  const links = safeParse(card.linked_concepts, []);

  const frontmatter = [
    '---',
    `id: ${card.id}`,
    `title: ${yamlStr(card.title)}`,
    `source_book: ${yamlStr(card.source_book)}`,
    `source_page: ${yamlStr(card.source_page)}`,
    `created: ${card.created_at.slice(0, 10)}`,
    `srs_due: ${card.srs_due}`,
    `srs_interval: ${card.srs_interval}`,
    `srs_efactor: ${card.srs_efactor}`,
    `tags: ${yamlArr(tags)}`,
    `linked_concepts: ${yamlArr(links)}`,
    '---',
    '',
    card.body,
    '',
  ].join('\n');

  return frontmatter;
}

// ─── write + verify ───────────────────────────────────────────────────────────

/**
 * Write a concept card to /data/vault/<sanitized-title>.md.
 * Returns the absolute vault_path that was written.
 */
function writeCard(card) {
  const sanitized = sanitizeTitle(card.title);
  const vaultPath = findVaultPath(sanitized);
  const content = buildMarkdown(card);
  fs.writeFileSync(vaultPath, content, 'utf8');
  return vaultPath;
}

/**
 * Read a vault file back and verify all required frontmatter keys are present.
 * Returns { ok: true } or { ok: false, missing: [...] }.
 */
function verifyFrontmatter(vaultPath) {
  const REQUIRED = [
    'id', 'title', 'source_book', 'source_page', 'created',
    'srs_due', 'srs_interval', 'srs_efactor', 'tags', 'linked_concepts',
  ];

  let content;
  try {
    content = fs.readFileSync(vaultPath, 'utf8');
  } catch (_) {
    return { ok: false, missing: REQUIRED };
  }

  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { ok: false, missing: REQUIRED };

  const presentKeys = new Set(
    match[1].split('\n')
      .map(line => line.match(/^(\w[\w_]*):/)?.[1])
      .filter(Boolean)
  );

  const missing = REQUIRED.filter(k => !presentKeys.has(k));
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_) { return fallback; }
}

module.exports = {
  sanitizeTitle,
  findVaultPath,
  parseWikiLinks,
  buildMarkdown,
  writeCard,
  verifyFrontmatter,
  VAULT_DIR,
};
