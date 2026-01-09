-- Add key column (no constraint)
ALTER TABLE sections ADD COLUMN key TEXT;

-- Backfill existing rows safely
UPDATE sections
SET key = LOWER(REPLACE(name, ' ', '_'))
WHERE key IS NULL;

-- Enforce uniqueness via index (SQLite-approved)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_key_unique
ON sections(key);
