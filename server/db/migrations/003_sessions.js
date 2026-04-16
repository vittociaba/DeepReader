function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      book_id     TEXT NOT NULL REFERENCES books(id),
      started_at  TEXT NOT NULL,
      last_active TEXT NOT NULL,
      ended_at    TEXT
    );
  `);
}

module.exports = { up };
