
/* ---------- Sections (fixed IDs to match UI: 1,2,3) ---------- */
INSERT OR IGNORE INTO sections (id, name, position_index)
VALUES
  (1, 'Tech', 0),
  (2, 'World', 1),
  (3, 'Sports', 2);

/* ---------- Feeds (enabled, meta filled by sync) ---------- */
INSERT OR IGNORE INTO feeds (url, title, site_url, is_enabled, fetch_interval_minutes)
VALUES
  ('https://hnrss.org/frontpage', NULL, NULL, 1, 30),         -- Tech
  ('http://feeds.bbci.co.uk/news/world/rss.xml', NULL, NULL, 1, 30),  -- World
  ('https://www.espn.com/espn/rss/news', NULL, NULL, 1, 30);   -- Sports

/* ---------- Map feeds to sections ---------- */
INSERT OR IGNORE INTO feed_sections (feed_id, section_id)
SELECT f.id, 1 FROM feeds f WHERE f.url = 'https://hnrss.org/frontpage';

INSERT OR IGNORE INTO feed_sections (feed_id, section_id)
SELECT f.id, 2 FROM feeds f WHERE f.url = 'http://feeds.bbci.co.uk/news/world/rss.xml';

INSERT OR IGNORE INTO feed_sections (feed_id, section_id)
SELECT f.id, 3 FROM feeds f WHERE f.url = 'https://www.espn.com/espn/rss/news';
