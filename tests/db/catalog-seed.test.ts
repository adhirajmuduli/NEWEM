import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_VERSION, RETIRED_FEED_URLS, SECTION_CONFIG } from '../../app/config/sections';
import { applyMigrations, closeDb, initDb } from '../../app/core/storage/db';
import { syncCatalogVersionIfNeeded } from '../../app/core/storage/sectionsSync';

const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-catalog-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  closeDb();
  while (roots.length) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('versioned production RSS catalog', () => {
  it('hardcodes the expected sections, unique feeds, and mappings', () => {
    const mappings = SECTION_CONFIG.flatMap((section) => section.feeds.map((feed) => section.key + '|' + feed.url));
    const uniqueUrls = new Set(SECTION_CONFIG.flatMap((section) => section.feeds.map((feed) => feed.url)));
    const withinSectionDuplicates = SECTION_CONFIG.filter(
      (section) => new Set(section.feeds.map((feed) => feed.url)).size !== section.feeds.length
    );
    expect(SECTION_CONFIG).toHaveLength(14);
    expect(mappings).toHaveLength(194);
    expect(new Set(mappings).size).toBe(194);
    expect(uniqueUrls.size).toBe(186);
    expect(withinSectionDuplicates).toEqual([]);
    for (const retired of RETIRED_FEED_URLS) expect(uniqueUrls.has(retired)).toBe(false);
  });

  it('seeds a fresh database once and records the catalog version', () => {
    const db = initDb(tempRoot());
    expect((db.prepare('SELECT COUNT(*) AS count FROM sections').get() as { count: number }).count).toBe(14);
    expect((db.prepare('SELECT COUNT(*) AS count FROM feeds').get() as { count: number }).count).toBe(186);
    expect((db.prepare('SELECT COUNT(*) AS count FROM feed_sections').get() as { count: number }).count).toBe(194);
    expect(JSON.parse((db.prepare("SELECT value_json FROM settings WHERE key='catalog_version'").get() as { value_json: string }).value_json)).toBe(CATALOG_VERSION);
    expect(syncCatalogVersionIfNeeded(db)).toMatchObject({ applied: false, createdSections: 0, createdMappings: 0 });
  });

  it('upgrades additively and reuses legacy default sections without changing stable keys', () => {
    const root = tempRoot();
    const file = path.join(root, 'catalog.db');
    const db = new Database(file);
    applyMigrations(db);
    db.prepare("INSERT INTO sections(key, name, position_index) VALUES ('tech', 'Tech', 0)").run();
    db.prepare("INSERT INTO sections(key, name, position_index) VALUES ('bhubaneswar', 'Bhubaneswar', 1)").run();
    db.prepare("INSERT INTO sections(key, name, position_index) VALUES ('custom', 'Custom Desk', 2)").run();

    const result = syncCatalogVersionIfNeeded(db);
    expect(result.applied).toBe(true);
    expect(db.prepare("SELECT name FROM sections WHERE key='tech'").get()).toEqual({ name: 'Technology' });
    expect(db.prepare("SELECT name FROM sections WHERE key='bhubaneswar'").get()).toEqual({ name: 'Odisha' });
    expect(db.prepare("SELECT name FROM sections WHERE key='custom'").get()).toEqual({ name: 'Custom Desk' });
    expect((db.prepare('SELECT COUNT(*) AS count FROM feed_sections').get() as { count: number }).count).toBe(194);
    expect(syncCatalogVersionIfNeeded(db).applied).toBe(false);
    db.close();
  });

  it('refreshes curated feed titles and retires removed catalog feeds on version upgrade', () => {
    const root = tempRoot();
    const file = path.join(root, 'catalog-upgrade.db');
    const db = new Database(file);
    applyMigrations(db);
    db.prepare("INSERT INTO sections(key, name, position_index) VALUES ('world', 'World', 0)").run();
    db.prepare("INSERT INTO sections(key, name, position_index) VALUES ('my-desk', 'My Desk', 1)").run();
    const worldId = (db.prepare("SELECT id FROM sections WHERE key='world'").get() as { id: number }).id;
    const deskId = (db.prepare("SELECT id FROM sections WHERE key='my-desk'").get() as { id: number }).id;

    db.prepare('INSERT INTO feeds(url, title) VALUES (?, ?)').run('https://feeds.bbci.co.uk/news/world/rss.xml', 'World News - BBC Old Format');
    const bbcId = (db.prepare('SELECT id FROM feeds WHERE url=?').get('https://feeds.bbci.co.uk/news/world/rss.xml') as { id: number }).id;
    db.prepare('INSERT INTO feed_sections(feed_id, section_id) VALUES (?, ?)').run(bbcId, worldId);

    db.prepare('INSERT INTO feeds(url, title) VALUES (?, ?)').run('https://feeds.reuters.com/Reuters/worldNews', 'Reuters - World News');
    const reutersId = (db.prepare('SELECT id FROM feeds WHERE url=?').get('https://feeds.reuters.com/Reuters/worldNews') as { id: number }).id;
    db.prepare('INSERT INTO feed_sections(feed_id, section_id) VALUES (?, ?)').run(reutersId, worldId);
    db.prepare('INSERT INTO feed_sections(feed_id, section_id) VALUES (?, ?)').run(reutersId, deskId);
    db.prepare("INSERT INTO settings(key, value_json) VALUES ('catalog_version', '1')").run();

    const result = syncCatalogVersionIfNeeded(db);

    expect(result.applied).toBe(true);
    expect(db.prepare('SELECT title FROM feeds WHERE id=?').get(bbcId)).toEqual({ title: 'BBC News - World' });
    expect(db.prepare('SELECT id FROM feeds WHERE id=?').get(reutersId)).toBeUndefined();
    expect((db.prepare('SELECT COUNT(*) AS count FROM feed_sections WHERE feed_id=?').get(reutersId) as { count: number }).count).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS count FROM feeds').get() as { count: number }).count).toBe(186);
    expect(JSON.parse((db.prepare("SELECT value_json FROM settings WHERE key='catalog_version'").get() as { value_json: string }).value_json)).toBe(CATALOG_VERSION);
    db.close();
  });
});