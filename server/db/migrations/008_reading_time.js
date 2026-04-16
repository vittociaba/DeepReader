function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_time (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT NOT NULL REFERENCES sessions(id),
      book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_index   INTEGER NOT NULL,
      page_index      INTEGER NOT NULL,
      seconds_spent   INTEGER NOT NULL DEFAULT 0,
      recorded_at     TEXT NOT NULL
    );
  `);
}

module.exports = { up };
