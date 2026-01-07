-- Log individual fetch attempts/results (optional but recommended)
CREATE TABLE IF NOT EXISTS fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER REFERENCES feeds(id) ON DELETE SET NULL,
  status TEXT NOT NULL,                 -- 'ok' | 'not_modified' | 'error'
  http_status INTEGER,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  duration_ms INTEGER,
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_fetch_log_feed_id ON fetch_log(feed_id);
CREATE INDEX IF NOT EXISTS idx_fetch_log_fetched_at ON fetch_log(fetched_at);