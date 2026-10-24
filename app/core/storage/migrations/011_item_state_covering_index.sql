CREATE INDEX IF NOT EXISTS idx_item_state_cover
ON item_state(item_id, is_read, is_important, read_at);
