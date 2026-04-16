function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chapter_recalls (
      id              TEXT PRIMARY KEY,
      book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_index   INTEGER NOT NULL,
      recall_text     TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      revised_at      TEXT
    );
  `);
}

module.exports = { up };
