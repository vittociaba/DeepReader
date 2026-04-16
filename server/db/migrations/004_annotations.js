function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS annotations (
      id              TEXT PRIMARY KEY,
      book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      session_id      TEXT NOT NULL REFERENCES sessions(id),
      chapter_index   INTEGER NOT NULL,
      page_index      INTEGER NOT NULL,
      paragraph_index INTEGER NOT NULL,
      char_offset     INTEGER NOT NULL,
      selected_text   TEXT NOT NULL,
      type            TEXT NOT NULL CHECK(type IN ('N','Q','C')),
      body            TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL
    );
  `);
}

module.exports = { up };
