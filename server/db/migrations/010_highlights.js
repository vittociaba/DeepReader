exports.up = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS highlights (
      id              TEXT PRIMARY KEY,
      book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_index   INTEGER NOT NULL,
      page_index      INTEGER NOT NULL,
      paragraph_index INTEGER NOT NULL,
      char_offset     INTEGER NOT NULL,
      length          INTEGER NOT NULL,
      selected_text   TEXT NOT NULL,
      created_at      TEXT NOT NULL
    )
  `);
};
