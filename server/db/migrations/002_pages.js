function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_index INTEGER NOT NULL,
      page_index    INTEGER NOT NULL,
      para_start    INTEGER NOT NULL,
      para_end      INTEGER NOT NULL,
      UNIQUE(book_id, chapter_index, page_index)
    );
  `);
}

module.exports = { up };
