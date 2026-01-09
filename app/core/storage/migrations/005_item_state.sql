-- Persistent item state: read + important flags
CREATE TABLE IF NOT EXISTS item_state (
  item_id INTEGER PRIMARY KEY,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_important INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_item_state_read ON item_state(is_read);
CREATE INDEX IF NOT EXISTS idx_item_state_important ON item_state(is_important);

-- Optional but recommended: add last_seen_at for fast filtering

PRAGMA foreign_keys=off;

ALTER TABLE feeds ADD COLUMN last_seen_at TEXT;

PRAGMA foreign_keys=on;

-- Backfill: treat legacy seen_at as read=true (preserves existing “seen” behavior)
INSERT INTO item_state (item_id, is_read, is_important, read_at)
SELECT i.id, 1, 0, i.seen_at
FROM items i
LEFT JOIN item_state s ON s.item_id = i.id
WHERE i.seen_at IS NOT NULL AND s.item_id IS NULL;