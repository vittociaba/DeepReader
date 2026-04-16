function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vocab_cards (
      id           TEXT PRIMARY KEY,
      word         TEXT NOT NULL,
      translation  TEXT,
      context      TEXT,
      book_id      TEXT REFERENCES books(id) ON DELETE SET NULL,
      source_page  TEXT,
      language     TEXT NOT NULL DEFAULT 'en',
      srs_interval INTEGER NOT NULL DEFAULT 1,
      srs_efactor  REAL    NOT NULL DEFAULT 2.5,
      srs_due      TEXT    NOT NULL,
      created_at   TEXT    NOT NULL
    );
  `);
}

module.exports = { up };
