import Database from 'better-sqlite3';
import { SECTION_CONFIG, type SectionConfig } from '../../config/sections';

function getSectionId(db: Database.Database, key: string): number | null {
  const row = db.prepare(`SELECT id FROM sections WHERE key=?`).get(key) as { id: number } | undefined;
  return row?.id ?? null;
}

function getSectionIdFallback(db: Database.Database, name: string): number | null {
  const row = db.prepare(`SELECT id FROM sections WHERE name=?`).get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

function upsertSection(db: Database.Database, cfg: SectionConfig): number {
  // 1. Stable identity: key
  const byKey = getSectionId(db, cfg.key);
  if (byKey) {
    db.prepare(
      `UPDATE sections
       SET name=@name, position_index=@pos
       WHERE id=@id`
    ).run({
      id: byKey,
      name: cfg.name,
      pos: cfg.position,
    });
    return byKey;
  }

  // 2. Legacy fallback: name → migrate to key
  const byName = getSectionIdFallback(db, cfg.name);
  if (byName) {
    db.prepare(
      `UPDATE sections
       SET key=@key, name=@name, position_index=@pos
       WHERE id=@id`
    ).run({
      id: byName,
      key: cfg.key,
      name: cfg.name,
      pos: cfg.position,
    });
    return byName;
  }

  // 3. Insert new section
  const res = db.prepare(
    `INSERT INTO sections(key, name, position_index)
     VALUES (@key, @name, @pos)`
  ).run({
    key: cfg.key,
    name: cfg.name,
    pos: cfg.position,
  });

  return Number(res.lastInsertRowid);
}

function getFeedIdByUrl(db: Database.Database, url: string): number | null {
  const row = db.prepare(`SELECT id FROM feeds WHERE url=?`).get(url) as { id: number } | undefined;
  return row ? row.id : null;
}

function ensureFeed(db: Database.Database, url: string, enabled: boolean, fetchIntervalMinutes?: number): number {
  const existing = getFeedIdByUrl(db, url);
  if (existing) return existing;
  const res = db
    .prepare(
      `INSERT INTO feeds(url, is_enabled, fetch_interval_minutes)
       VALUES (@url, @enabled, @interval)`
    )
    .run({
      url,
      enabled: enabled ? 1 : 0,
      interval: fetchIntervalMinutes ?? null,
    });
  return Number(res.lastInsertRowid);
}

function ensureMapping(db: Database.Database, feedId: number, sectionId: number) {
  db.prepare(
    `INSERT OR IGNORE INTO feed_sections(feed_id, section_id)
     VALUES (@feedId, @sectionId)`
  ).run({ feedId, sectionId });
}

export function syncSectionsFromConfig(db: Database.Database) {
  db.prepare(`
    UPDATE sections
    SET key = LOWER(REPLACE(name, ' ', '_'))
    WHERE key IS NULL
  `).run();

  db.transaction(() => {
    for (const cfg of SECTION_CONFIG) {
      const sectionId = upsertSection(db, cfg);
      for (const url of cfg.feeds) {
        const feedId = ensureFeed(db, url, cfg.enabled !== false, cfg.fetchIntervalMinutes);
        ensureMapping(db, feedId, sectionId);
      }
    }
  })();
}