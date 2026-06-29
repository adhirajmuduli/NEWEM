-- Storage contract cleanup for user-managed feeds/sections.
-- Optional legacy columns are reconciled in ensureStorageContract().

UPDATE sections
SET key = LOWER(REPLACE(name, ' ', '_'))
WHERE key IS NULL OR TRIM(key) = '';

UPDATE feeds
SET is_enabled = 1
WHERE is_enabled IS NULL;

UPDATE feeds
SET fetch_interval_minutes = NULL
WHERE fetch_interval_minutes IS NOT NULL
  AND fetch_interval_minutes < 1;

INSERT INTO settings(key, value_json)
VALUES
  ('layout', '{"panels":[]}'),
  ('show_seen_news', 'false'),
  ('theme_mode', '"light"')
ON CONFLICT(key) DO NOTHING;