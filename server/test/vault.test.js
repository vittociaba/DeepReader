/**
 * Unit tests — vault.js
 * Covers: sanitizeTitle, parseWikiLinks, buildMarkdown, writeCard, verifyFrontmatter.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

// Point vault at a temp dir so we don't touch /data/vault
const tmpVault = path.join(os.tmpdir(), `dr-vault-test-${Date.now()}`);
process.env.VAULT_DIR = tmpVault;

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeTitle,
  parseWikiLinks,
  buildMarkdown,
  writeCard,
  verifyFrontmatter,
} = require('../lib/vault');

before(() => fs.mkdirSync(tmpVault, { recursive: true }));
after(() => fs.rmSync(tmpVault, { recursive: true, force: true }));

// ─── Sample card ──────────────────────────────────────────────────────────────

const SAMPLE_CARD = {
  id: 'test-card-uuid-001',
  annotation_id: null,
  title: 'The Pragmatic Programmer',
  source_book: 'The Pragmatic Programmer',
  source_page: 'ch2 p5',
  body: 'Code should be [[DRY]] and [[SOLID]] principles apply.\n\n{{c1::Don\'t Repeat Yourself}}',
  tags: JSON.stringify(['programming', 'best-practices']),
  linked_concepts: JSON.stringify([]),  // will be populated by route logic
  srs_interval: 1,
  srs_efactor: 2.5,
  srs_due: '2026-03-24',
  created_at: '2026-03-24T10:00:00.000Z',
  vault_path: '',
};

// ─── sanitizeTitle ────────────────────────────────────────────────────────────

test('sanitizeTitle — basic title', () => {
  assert.equal(sanitizeTitle('The Pragmatic Programmer'), 'The-Pragmatic-Programmer');
});

test('sanitizeTitle — removes illegal chars', () => {
  assert.equal(sanitizeTitle('My: Title? With* Chars'), 'My-Title-With-Chars');
});

test('sanitizeTitle — collapses multiple spaces/hyphens', () => {
  assert.equal(sanitizeTitle('Hello   World'), 'Hello-World');
});

test('sanitizeTitle — strips leading/trailing hyphens', () => {
  assert.equal(sanitizeTitle('  :My Title:  '), 'My-Title');
});

test('sanitizeTitle — empty string falls back to "untitled"', () => {
  assert.equal(sanitizeTitle(''), 'untitled');
  assert.equal(sanitizeTitle('   '), 'untitled');
});

test('sanitizeTitle — truncates at 100 chars', () => {
  const long = 'a'.repeat(200);
  assert.equal(sanitizeTitle(long).length, 100);
});

// ─── parseWikiLinks ───────────────────────────────────────────────────────────

test('parseWikiLinks — extracts single link', () => {
  const links = parseWikiLinks('See [[DRY principle]] for details.');
  assert.deepEqual(links, ['DRY principle']);
});

test('parseWikiLinks — extracts multiple links', () => {
  const links = parseWikiLinks('[[DRY]] and [[SOLID]] and [[YAGNI]]');
  assert.deepEqual(links, ['DRY', 'SOLID', 'YAGNI']);
});

test('parseWikiLinks — deduplicates repeated links', () => {
  const links = parseWikiLinks('[[DRY]] here and also [[DRY]] there');
  assert.deepEqual(links, ['DRY']);
});

test('parseWikiLinks — handles pipe-aliased links [[target|alias]]', () => {
  const links = parseWikiLinks('See [[DRY|Don\'t Repeat Yourself]] here');
  assert.deepEqual(links, ['DRY']);
});

test('parseWikiLinks — returns empty array for no links', () => {
  const links = parseWikiLinks('No links here at all.');
  assert.deepEqual(links, []);
});

test('parseWikiLinks — returns empty array for null/empty body', () => {
  assert.deepEqual(parseWikiLinks(''), []);
  assert.deepEqual(parseWikiLinks(null), []);
});

// ─── buildMarkdown ────────────────────────────────────────────────────────────

test('buildMarkdown — starts with YAML front matter', () => {
  const md = buildMarkdown(SAMPLE_CARD);
  assert.ok(md.startsWith('---\n'), 'must start with ---');
});

test('buildMarkdown — contains closing front matter delimiter', () => {
  const md = buildMarkdown(SAMPLE_CARD);
  assert.ok(md.includes('\n---\n'), 'must have closing ---');
});

test('buildMarkdown — contains all required YAML keys', () => {
  const md = buildMarkdown(SAMPLE_CARD);
  const required = ['id', 'title', 'source_book', 'source_page',
    'created', 'srs_due', 'srs_interval', 'srs_efactor', 'tags', 'linked_concepts'];
  for (const key of required) {
    assert.ok(md.includes(`\n${key}:`), `missing key: ${key}`);
  }
});

test('buildMarkdown — card body appears after front matter', () => {
  const md = buildMarkdown(SAMPLE_CARD);
  const bodyStart = md.indexOf('\n---\n') + 5;
  assert.ok(md.slice(bodyStart).includes('{{c1::'), 'cloze mask should be in body');
});

test('buildMarkdown — tags serialized as inline YAML array', () => {
  const md = buildMarkdown(SAMPLE_CARD);
  assert.ok(md.includes('tags: ["programming"'), 'tags should be quoted in array');
});

// ─── writeCard + verifyFrontmatter ────────────────────────────────────────────

test('writeCard — creates .md file in vault', () => {
  const vaultPath = writeCard(SAMPLE_CARD);
  assert.ok(fs.existsSync(vaultPath), `file should exist at ${vaultPath}`);
  assert.ok(vaultPath.endsWith('.md'), 'must have .md extension');
});

test('writeCard — filename is sanitized title', () => {
  const card = { ...SAMPLE_CARD, title: 'My Card Title', id: 'unique-id-002' };
  const vaultPath = writeCard(card);
  assert.ok(path.basename(vaultPath).startsWith('My-Card-Title'), 'filename matches sanitized title');
});

test('writeCard — collision handling creates -2, -3 variants', () => {
  const card1 = { ...SAMPLE_CARD, title: 'Collision Test', id: 'coll-001' };
  const card2 = { ...SAMPLE_CARD, title: 'Collision Test', id: 'coll-002' };
  const card3 = { ...SAMPLE_CARD, title: 'Collision Test', id: 'coll-003' };
  const p1 = writeCard(card1);
  const p2 = writeCard(card2);
  const p3 = writeCard(card3);
  assert.ok(p1.endsWith('Collision-Test.md'), `p1 should be base: ${p1}`);
  assert.ok(p2.endsWith('Collision-Test-2.md'), `p2 should be -2: ${p2}`);
  assert.ok(p3.endsWith('Collision-Test-3.md'), `p3 should be -3: ${p3}`);
});

test('verifyFrontmatter — returns ok:true for valid card', () => {
  const card = { ...SAMPLE_CARD, title: 'Verify Test', id: 'verify-001' };
  const vaultPath = writeCard(card);
  const result = verifyFrontmatter(vaultPath);
  assert.equal(result.ok, true, `verify failed, missing: ${JSON.stringify(result.missing)}`);
});

test('verifyFrontmatter — returns ok:false for missing file', () => {
  const result = verifyFrontmatter('/no/such/path.md');
  assert.equal(result.ok, false);
});

test('verifyFrontmatter — file content is valid Obsidian note', () => {
  const card = {
    ...SAMPLE_CARD,
    title: 'Obsidian Verify',
    id: 'obsidian-001',
    tags: JSON.stringify(['test']),
    linked_concepts: JSON.stringify(['DRY', 'SOLID']),
  };
  const vaultPath = writeCard(card);
  const content = fs.readFileSync(vaultPath, 'utf8');

  // Must start with ---
  assert.ok(content.startsWith('---\n'));
  // Must contain id: test-card-uuid-001 style line
  assert.ok(content.includes('id: obsidian-001'));
  // Must contain srs fields
  assert.ok(content.match(/srs_interval: \d+/));
  assert.ok(content.match(/srs_efactor: [\d.]+/));
  // Body must appear after closing ---
  const sep = content.indexOf('\n---\n');
  assert.ok(sep > 0, 'closing --- not found');
  const body = content.slice(sep + 5);
  assert.ok(body.includes('{{c1::'), 'cloze in body');
});
