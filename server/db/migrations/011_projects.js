function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#4a9eff',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_books (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      book_id    TEXT NOT NULL REFERENCES books(id)    ON DELETE CASCADE,
      added_at   TEXT NOT NULL,
      PRIMARY KEY (project_id, book_id)
    );
  `);
}

module.exports = { up };
