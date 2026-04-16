function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id            TEXT PRIMARY KEY,
      filename      TEXT NOT NULL,
      title         TEXT,
      author        TEXT,
      cover_path    TEXT,
      chapter_count INTEGER,
      imported_at   TEXT NOT NULL
    );
  `);
}

module.exports = { up };
