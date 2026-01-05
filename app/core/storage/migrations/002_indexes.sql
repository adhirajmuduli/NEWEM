CREATE UNIQUE INDEX IF NOT EXISTS idx_items_dedupe_key ON items(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at);
CREATE INDEX IF NOT EXISTS idx_items_feed_id ON items(feed_id);

CREATE INDEX IF NOT EXISTS idx_feeds_is_enabled ON feeds(is_enabled);
CREATE INDEX IF NOT EXISTS idx_sections_position ON sections(position_index);
