function up(db) {
  // Add columns for leech detection and card retirement.
  // Using try/catch per column because ALTER TABLE ADD COLUMN
  // doesn't support IF NOT EXISTS in SQLite.
  const columns = [
    "ALTER TABLE concept_cards ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE concept_cards ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE concept_cards ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE concept_cards ADD COLUMN success_streak INTEGER NOT NULL DEFAULT 0",
  ];

  for (const sql of columns) {
    try {
      db.exec(sql);
    } catch (err) {
      // Column already exists — safe to ignore
      if (!err.message.includes('duplicate column')) throw err;
    }
  }
}

module.exports = { up };
