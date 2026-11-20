BEGIN;
CREATE TABLE IF NOT EXISTS sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  en TEXT NOT NULL,
  zh TEXT NOT NULL,
  pattern TEXT DEFAULT '',
  grammar_point TEXT DEFAULT '',
  source TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS user_sentence_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sentence_id INTEGER NOT NULL,
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_review_at TEXT,
  UNIQUE(user_id, sentence_id)
);
COMMIT;
