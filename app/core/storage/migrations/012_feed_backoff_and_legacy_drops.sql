ALTER TABLE feeds ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feeds ADD COLUMN next_retry_at TEXT;
ALTER TABLE items DROP COLUMN seen_at;
ALTER TABLE feeds DROP COLUMN last_seen_at;
