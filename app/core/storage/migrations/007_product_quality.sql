ALTER TABLE feeds ADD COLUMN is_muted INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_items_search_time
ON items(published_at, created_at);
