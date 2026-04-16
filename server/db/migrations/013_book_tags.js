function up(db) {
  try {
    db.exec(`ALTER TABLE books ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  } catch (_) { /* column already exists — idempotent */ }
}

module.exports = { up };
