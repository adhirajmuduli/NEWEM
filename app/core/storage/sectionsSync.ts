import Database from 'better-sqlite3';
import { assertValidFeedUrl } from '../rss/url';
import { CATALOG_VERSION, SECTION_CONFIG, type SectionConfig } from '../../config/sections';

const CATALOG_SETTING_KEY = 'catalog_version';

type SectionRow = { id: number; key: string; name: string; position_index: number };

function catalogVersion(db: Database.Database) {
  const row = db.prepare('SELECT value_json FROM settings WHERE key=?').get(CATALOG_SETTING_KEY) as
    | { value_json: string }
    | undefined;
  if (!row) return 0;
  try {
    const value = JSON.parse(row.value_json);
    return typeof value === 'number' && Number.isInteger(value) ? value : 0;
  } catch {
    return 0;
  }
}

function findSection(db: Database.Database, config: SectionConfig) {
  for (const key of [config.key, ...config.legacyKeys]) {
    const row = db.prepare('SELECT * FROM sections WHERE key=?').get(key) as SectionRow | undefined;
    if (row) return row;
  }
  for (const name of [config.name, ...config.legacyNames]) {
    const row = db.prepare('SELECT * FROM sections WHERE name=?').get(name) as SectionRow | undefined;
    if (row) return row;
  }
  return undefined;
}

function createCatalogSection(db: Database.Database, config: SectionConfig, position: number) {
  return db.prepare(
    'INSERT INTO sections(key, name, position_index) VALUES (@key, @name, @position) RETURNING *'
  ).get({ key: config.key, name: config.name, position }) as SectionRow;
}

function normalizeLegacySectionName(db: Database.Database, section: SectionRow, config: SectionConfig) {
  if (section.name === config.name || !config.legacyNames.includes(section.name)) return section;
  const conflict = db.prepare('SELECT id FROM sections WHERE name=? AND id<>?').get(config.name, section.id);
  if (conflict) return section;
  return db.prepare(
    "UPDATE sections SET name=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? RETURNING *"
  ).get(config.name, section.id) as SectionRow;
}

function ensureFeed(db: Database.Database, config: SectionConfig, title: string, inputUrl: string) {
  const url = assertValidFeedUrl(inputUrl);
  return db.prepare(
    "INSERT INTO feeds(url, title, is_enabled, fetch_interval_minutes) " +
    "VALUES (@url, @title, @enabled, @interval) " +
    "ON CONFLICT(url) DO UPDATE SET " +
    "title=CASE WHEN feeds.title IS NULL OR TRIM(feeds.title) = '' THEN excluded.title ELSE feeds.title END, " +
    "updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') RETURNING id"
  ).get({
    url,
    title,
    enabled: config.enabled ? 1 : 0,
    interval: config.fetchIntervalMinutes,
  }) as { id: number };
}

function applyCatalog(db: Database.Database, writeVersion: boolean) {
  const existingCount = (db.prepare('SELECT COUNT(*) AS count FROM sections').get() as { count: number }).count;
  let nextPosition = (db.prepare('SELECT COALESCE(MAX(position_index), -1) + 1 AS position FROM sections').get() as { position: number }).position;
  let createdSections = 0;
  let createdMappings = 0;

  for (const config of SECTION_CONFIG) {
    let section = findSection(db, config);
    if (!section) {
      section = createCatalogSection(db, config, existingCount === 0 ? config.position : nextPosition++);
      createdSections += 1;
    } else {
      section = normalizeLegacySectionName(db, section, config);
    }

    for (const feedConfig of config.feeds) {
      const feed = ensureFeed(db, config, feedConfig.title, feedConfig.url);
      const result = db.prepare(
        'INSERT INTO feed_sections(feed_id, section_id) VALUES (?, ?) ' +
        'ON CONFLICT(feed_id, section_id) DO NOTHING'
      ).run(feed.id, section.id);
      createdMappings += result.changes;
    }
  }

  if (writeVersion) {
    db.prepare(
      'INSERT INTO settings(key, value_json) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json'
    ).run(CATALOG_SETTING_KEY, JSON.stringify(CATALOG_VERSION));
  }
  return { applied: true, createdSections, createdMappings, version: CATALOG_VERSION };
}

export function syncCatalogVersionIfNeeded(db: Database.Database) {
  if (catalogVersion(db) >= CATALOG_VERSION) {
    return { applied: false, createdSections: 0, createdMappings: 0, version: CATALOG_VERSION };
  }
  return db.transaction(() => applyCatalog(db, true))();
}

export function syncSectionsFromConfig(db: Database.Database) {
  return db.transaction(() => applyCatalog(db, false))();
}

export function seedSectionsFromConfigIfEmpty(db: Database.Database) {
  return syncCatalogVersionIfNeeded(db);
}