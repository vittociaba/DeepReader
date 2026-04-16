function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS concept_cards (
      id              TEXT PRIMARY KEY,
      annotation_id   TEXT REFERENCES annotations(id),
      title           TEXT NOT NULL,
      source_book     TEXT NOT NULL,
      source_page     TEXT NOT NULL,
      body            TEXT NOT NULL,
      tags            TEXT NOT NULL DEFAULT '[]',
      linked_concepts TEXT NOT NULL DEFAULT '[]',
      srs_interval    INTEGER NOT NULL DEFAULT 1,
      srs_efactor     REAL NOT NULL DEFAULT 2.5,
      srs_due         TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      vault_path      TEXT NOT NULL
    );
  `);
}

module.exports = { up };
