import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_VERSION, SECTION_CONFIG } from '../../app/config/sections';
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
    expect(SECTION_CONFIG).toHaveLength(14);
    expect(mappings).toHaveLength(158);
    expect(new Set(mappings).size).toBe(158);
    expect(uniqueUrls.size).toBe(110);
  });

  it('seeds a fresh database once and records the catalog version', () => {
    const db = initDb(tempRoot());
    expect((db.prepare('SELECT COUNT(*) AS count FROM sections').get() as { count: number }).count).toBe(14);
    expect((db.prepare('SELECT COUNT(*) AS count FROM feeds').get() as { count: number }).count).toBe(110);
    expect((db.prepare('SELECT COUNT(*) AS count FROM feed_sections').get() as { count: number }).count).toBe(158);
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
    expect((db.prepare('SELECT COUNT(*) AS count FROM feed_sections').get() as { count: number }).count).toBe(158);
    expect(syncCatalogVersionIfNeeded(db).applied).toBe(false);
    db.close();
  });
});