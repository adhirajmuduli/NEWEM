import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../../app/core/storage/db';
import { createFeed, getFeed, updateFeedSettings } from '../../app/core/storage/dao/feedsDao';
import { assignFeedToSection, createSection, listFeedsForSection } from '../../app/core/storage/dao/sectionsDao';
import { getItemsBySection, insertItems, markItemRead, toggleItemImportant } from '../../app/core/storage/dao/itemsDao';
import { exportOpml, importOpml, parseOpml } from '../../app/core/storage/portability';
import { exportDatabaseBackup, exportDiagnostics } from '../../app/main/exports';

const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-stage7-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  closeDb();
  while (roots.length) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('Stage 7 local data features', () => {
  it('searches and filters items using bound local queries', () => {
    const db = initDb(tempRoot());
    const section = createSection(db, 'Stage 7 Search');
    const feed = createFeed(db, 'https://example.com/rss.xml');
    assignFeedToSection(db, feed.id, section.id);
    insertItems(db, feed.id, [
      { link: 'https://example.com/alpha', title: 'Alpha research', description: 'Local search body', published_at: '2026-06-26T10:00:00.000Z', dedupe_key: 'alpha' },
      { link: 'https://example.com/beta', title: 'Beta bulletin', description: 'Other body', published_at: '2026-06-01T10:00:00.000Z', dedupe_key: 'beta' },
    ]);
    const rows = getItemsBySection(db, section.id, { includeSeen: true });
    markItemRead(db, rows.find((row) => row.title === 'Beta bulletin')!.id);
    toggleItemImportant(db, rows.find((row) => row.title === 'Alpha research')!.id);

    expect(getItemsBySection(db, -1, { includeSeen: true, query: 'research' }).map((row) => row.title)).toEqual(['Alpha research']);
    expect(getItemsBySection(db, -1, { includeSeen: true, unreadOnly: true }).map((row) => row.title)).toEqual(['Alpha research']);
    expect(getItemsBySection(db, -1, { includeSeen: true, importantOnly: true }).map((row) => row.title)).toEqual(['Alpha research']);
    expect(getItemsBySection(db, -1, { includeSeen: true, publishedAfter: '2026-06-20T00:00:00.000Z' })).toHaveLength(1);
  });

  it('round-trips OPML mappings and persists mute and interval settings', () => {
    const db = initDb(tempRoot());
    const section = createSection(db, 'Portable');
    const result = importOpml(db, '<?xml version="1.0"?><opml version="2.0"><body><outline text="Sources"><outline type="rss" text="Example" xmlUrl="https://example.com/rss.xml" /></outline></body></opml>', section.id);
    expect(result).toEqual({ imported: 1, skipped: 0 });
    const feed = listFeedsForSection(db, section.id)[0] as { id: number };
    updateFeedSettings(db, feed.id, { muted: true, fetchIntervalMinutes: 90 });
    expect(getFeed(db, feed.id)).toMatchObject({ is_muted: 1, fetch_interval_minutes: 90 });
    const opml = exportOpml(db);
    expect(parseOpml(opml)).toEqual(expect.arrayContaining([expect.objectContaining({ url: 'https://example.com/rss.xml' })]));
  });

  it('exports backups and diagnostics only to an explicit temporary directory', async () => {
    const root = tempRoot();
    const db = initDb(path.join(root, 'database'));
    const output = path.join(root, 'exports');
    const backup = await exportDatabaseBackup(db, output);
    const diagnostics = exportDiagnostics(db, output);
    expect(fs.existsSync(backup)).toBe(true);
    expect(fs.existsSync(diagnostics.filePath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(diagnostics.filePath, 'utf8'))).toMatchObject({
      counts: expect.objectContaining({ sections: expect.any(Number), feeds: expect.any(Number), items: expect.any(Number) }),
      migrations: expect.any(Array),
    });
  });
});