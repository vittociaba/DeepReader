function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id       TEXT NOT NULL REFERENCES concept_cards(id) ON DELETE CASCADE,
      rating        INTEGER NOT NULL,
      confidence    INTEGER,
      review_mode   TEXT DEFAULT 'cloze',
      reviewed_at   TEXT NOT NULL
    );
  `);
}

module.exports = { up };
