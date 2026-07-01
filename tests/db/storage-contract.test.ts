import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, initDb, listMigrationFiles } from '../../app/core/storage/db';
import { createFeed, getFeed, markFeedError, markFeedFetched, tryLockFeed } from '../../app/core/storage/dao/feedsDao';
import {
  assignFeedToSection,
  createSection,
  listFeedsForSection,
  listSections,
  reorderSections,
  updateSection,
} from '../../app/core/storage/dao/sectionsDao';
import {
  getItemsBySection,
  insertItems,
  markItemRead,
  markSectionSeen,
  toggleItemImportant,
} from '../../app/core/storage/dao/itemsDao';
import { logFetch } from '../../app/core/rss/persist';

const tempRoots: string[] = [];

function tempDbDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-db-test-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  closeDb();
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tableColumns(db: Database.Database, table: string) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row: any) => row.name));
}

describe('storage migrations', () => {
  it('applies all discovered migrations to a fresh temporary database', () => {
    const dir = tempDbDir();
    const db = initDb(dir);

    const applied = db.prepare(`SELECT name FROM schema_migrations ORDER BY name`).all().map((row: any) => row.name);
    expect(applied).toEqual(listMigrationFiles());
    expect(tableColumns(db, 'sections').has('key')).toBe(true);
    expect(tableColumns(db, 'feeds').has('last_error')).toBe(true);
    expect(tableColumns(db, 'feeds').has('is_fetching')).toBe(true);
    expect(tableColumns(db, 'item_state').has('is_important')).toBe(true);
    expect(db.prepare(`SELECT value_json FROM settings WHERE key='layout'`).get()).toBeTruthy();
    expect(listSections(db).length).toBeGreaterThan(0);
  });

  it('upgrades older databases with seen_at, missing section keys, and optional fetch_error', () => {
    const dir = tempDbDir();
    const file = path.join(dir, 'app.db');
    const oldDb = new Database(file);
    oldDb.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations(name, applied_at) VALUES
        ('001_init.sql', '2026-01-01T00:00:00.000Z'),
        ('002_indexes.sql', '2026-01-01T00:00:00.000Z'),
        ('003_fetch_log.sql', '2026-01-01T00:00:00.000Z');
      CREATE TABLE feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT,
        site_url TEXT,
        etag TEXT,
        last_modified TEXT,
        last_fetched_at TEXT,
        fetch_interval_minutes INTEGER,
        fetch_error TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        position_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE feed_sections (
        feed_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL,
        PRIMARY KEY (feed_id, section_id),
        FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
      );
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id INTEGER NOT NULL,
        guid TEXT,
        link TEXT NOT NULL,
        title TEXT,
        description TEXT,
        published_at TEXT,
        dedupe_key TEXT NOT NULL,
        seen_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
      CREATE TABLE fetch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id INTEGER,
        status TEXT NOT NULL,
        http_status INTEGER,
        fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        duration_ms INTEGER,
        message TEXT,
        FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE SET NULL
      );
      INSERT INTO sections(name, position_index) VALUES ('Legacy Section', 0);
      INSERT INTO feeds(url, fetch_error, is_enabled) VALUES ('https://example.com/rss.xml', 'legacy failure', 1);
      INSERT INTO feed_sections(feed_id, section_id) VALUES (1, 1);
      INSERT INTO items(feed_id, link, title, dedupe_key, seen_at, published_at)
      VALUES (1, 'https://example.com/a', 'Seen item', 'legacy-seen', '2026-01-01T00:00:00.000Z', 'Mon, 29 Jun 2026 12:30:00 GMT');
    `);
    oldDb.close();

    const db = initDb(dir);
    const feed = db.prepare(`SELECT * FROM feeds WHERE id=1`).get() as any;
    const section = db.prepare(`SELECT * FROM sections WHERE id=1`).get() as any;
    const state = db.prepare(`SELECT * FROM item_state WHERE item_id=1`).get() as any;

    expect(section.key).toBe('legacy_section');
    expect(feed.last_error).toBe('legacy failure');
    expect(feed.is_fetching).toBe(0);
    expect(state.is_read).toBe(1);
    expect(state.read_at).toBe('2026-01-01T00:00:00.000Z');
    expect(db.prepare(`SELECT published_at FROM items WHERE id=1`).get()).toMatchObject({ published_at: '2026-06-29T12:30:00.000Z' });
    expect(listSections(db)).toHaveLength(15);
    expect(listSections(db).some((row) => row.name === 'Legacy Section')).toBe(true);
  });
});

describe('storage DAOs', () => {
  it('supports section CRUD and feed assignment contracts', () => {
    const db = initDb(tempDbDir());
    const created = createSection(db, 'Science Desk', 42, 'science');
    const renamed = updateSection(db, created.id, { name: 'Science' });
    const feed = createFeed(db, 'https://example.com/science.xml');

    assignFeedToSection(db, feed.id, created.id);
    reorderSections(db, [created.id]);

    expect(renamed?.key).toBe('science');
    expect(listFeedsForSection(db, created.id).map((row: any) => row.url)).toContain('https://example.com/science.xml');
    expect(listSections(db).find((section) => section.id === created.id)?.position_index).toBe(0);
  });

  it('uses item_state as canonical read and important visibility state', () => {
    const db = initDb(tempDbDir());
    const section = createSection(db, 'Reading', 0, 'reading');
    const feed = createFeed(db, 'https://example.com/read.xml');
    assignFeedToSection(db, feed.id, section.id);
    insertItems(db, feed.id, [
      { link: 'https://example.com/1', title: 'One', dedupe_key: 'one' },
      { link: 'https://example.com/2', title: 'Two', dedupe_key: 'two' },
    ]);

    expect(getItemsBySection(db, section.id).map((item) => item.title).sort()).toEqual(['One', 'Two']);

    const first = getItemsBySection(db, section.id).find((item) => item.title === 'One');
    expect(first).toBeTruthy();
    markItemRead(db, first!.id);
    expect(getItemsBySection(db, section.id).map((item) => item.title)).toEqual(['Two']);

    toggleItemImportant(db, first!.id);
    const visible = getItemsBySection(db, section.id);
    expect(visible.find((item) => item.title === 'One')?.is_important).toBe(1);

    const changed = markSectionSeen(db, section.id);
    expect(changed).toBe(1);
    expect(getItemsBySection(db, section.id).map((item) => item.title)).toEqual(['One']);
    expect(getItemsBySection(db, section.id, { includeSeen: true })).toHaveLength(2);
  });

  it('returns every stored item only when the caller explicitly requests an uncapped read', () => {
    const db = initDb(tempDbDir());
    const section = createSection(db, 'Archive', 0, 'archive');
    const feed = createFeed(db, 'https://example.com/archive.xml');
    assignFeedToSection(db, feed.id, section.id);
    insertItems(db, feed.id, Array.from({ length: 240 }, (_, index) => ({
      link: `https://example.com/archive/${index}`,
      title: `Archive ${index}`,
      published_at: new Date(Date.UTC(2026, 5, 29, 0, 0, index)).toISOString(),
      dedupe_key: `archive-${index}`,
    })));

    expect(getItemsBySection(db, section.id, { includeSeen: true })).toHaveLength(50);
    expect(getItemsBySection(db, section.id, { includeSeen: true, all: true })).toHaveLength(240);
  });
  it('persists user-defined sections and feed mappings across database reopen', () => {
    const dir = tempDbDir();
    let db = initDb(dir);
    const section = createSection(db, 'Local Desk', 0, 'local_desk');
    const feed = createFeed(db, 'https://example.com/local.xml');
    assignFeedToSection(db, feed.id, section.id);

    closeDb();
    db = initDb(dir);

    const persistedSection = listSections(db).find((row) => row.key === 'local_desk');
    expect(persistedSection?.name).toBe('Local Desk');
    expect(listFeedsForSection(db, persistedSection!.id).map((row: any) => row.url)).toEqual(['https://example.com/local.xml']);
  });
  it('records canonical feed lifecycle and fetch log state', () => {
    const db = initDb(tempDbDir());
    const feed = createFeed(db, 'https://example.com/feed.xml');

    expect(tryLockFeed(db, feed.id)).toBe(true);
    expect(getFeed(db, feed.id)?.is_fetching).toBe(1);

    markFeedError(db, feed.id, 'network failed');
    expect(getFeed(db, feed.id)?.is_fetching).toBe(0);
    expect(getFeed(db, feed.id)?.last_error).toBe('network failed');

    expect(tryLockFeed(db, feed.id)).toBe(true);
    markFeedFetched(db, feed.id);
    expect(getFeed(db, feed.id)?.is_fetching).toBe(0);
    expect(getFeed(db, feed.id)?.last_error).toBeNull();

    logFetch(db, { feedId: feed.id, status: 'ok', httpStatus: 200, durationMs: 12, message: 'inserted=1' });
    const row = db.prepare(`SELECT * FROM fetch_log WHERE feed_id=?`).get(feed.id) as any;
    expect(row.status).toBe('ok');
    expect(row.http_status).toBe(200);
    expect(row.message).toBe('inserted=1');
  });
});
