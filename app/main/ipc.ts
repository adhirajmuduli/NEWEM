interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: any[]) => any): void;
}

declare const require: any;
const electron = (() => {
  try {
    return require('electron');
  } catch {
    return null;
  }
})();
const electronShell = electron?.shell;

import { getDb } from '../core/storage/db';
import { createFeed, getFeed, updateFeedSettings } from '../core/storage/dao/feedsDao';
import {
  assignFeedToSection,
  createSection,
  deleteSection,
  listFeedsForSection,
  listSections,
  reorderSections,
  updateSection,
  unassignFeedFromSection,
} from '../core/storage/dao/sectionsDao';
import { getItemsBySection, markSeen as markItemsSeen, markSectionSeen, ItemRow, markItemRead, toggleItemImportant } from '../core/storage/dao/itemsDao';
import { getLayout, getShowSeen, setLayout } from '../core/storage/dao/settingsDao';
import { resolveFeedInput } from '../core/rss/discovery';
import { syncAllFeeds, syncFeeds, syncSection, type ManualSyncResult, type SyncProgress } from '../core/rss/sync';
import { assertValidFeedUrl } from '../core/rss/url';
import { exportOpml, importOpml } from '../core/storage/portability';
import { exportDatabaseBackup, exportDiagnostics } from './exports';
import { withModule } from './logging';
import { isAllowedExternalUrl } from './security';
import {
  booleanValue,
  handleValidated,
  layoutValue,
  numberValue,
  optionalBoolean,
  optionalNumber,
  optionalPayload,
  optionalString,
  passthroughResponse,
  rejectUnknown,
  stringValue,
} from './ipcValidation';
import type {
  ExternalOpenPayload,
  FeedAddToSectionPayload,
  FeedRemoveFromSectionPayload,
  FeedTestPayload,
  FeedUpdatePayload,
  ItemsQueryPayload,
  LayoutSetPayload,
  MarkItemReadPayload,
  OpmlImportPayload,
  SectionCreatePayload,
  SectionDeletePayload,
  SectionReorderPayload,
  SectionUpdatePayload,
  SyncTriggerPayload,
} from '../shared/ipcTypes';

export type SyncTriggerResponse = ManualSyncResult;

const log = withModule('ipc');

function feedCounts(db: ReturnType<typeof getDb>, feedId: number) {
  return db.prepare(
    `SELECT COUNT(i.id) AS item_count,
            SUM(CASE WHEN COALESCE(s.is_read, 0) = 0 THEN 1 ELSE 0 END) AS unread_count
     FROM items i
     LEFT JOIN item_state s ON s.item_id = i.id
     WHERE i.feed_id = ?`
  ).get(feedId) as { item_count: number; unread_count: number | null };
}

function feedWire(db: ReturnType<typeof getDb>, feed: any) {
  const counts = feedCounts(db, feed.id);
  return {
    id: feed.id,
    url: feed.url,
    title: feed.title ?? null,
    site_url: feed.site_url ?? null,
    last_fetched_at: feed.last_fetched_at ?? null,
    last_error: feed.last_error ?? null,
    fetch_interval_minutes: feed.fetch_interval_minutes ?? null,
    is_enabled: feed.is_enabled as 0 | 1,
    is_muted: (feed.is_muted ?? 0) as 0 | 1,
    item_count: counts.item_count ?? 0,
    unread_count: counts.unread_count ?? 0,
  };
}

function sectionWire(db: ReturnType<typeof getDb>, section: any) {
  return { ...section, feeds: (listFeedsForSection(db, section.id) as any[]).map((feed) => feedWire(db, feed)) };
}

function listSectionsResponse() {
  const db = getDb();
  return { sections: listSections(db).map((section) => sectionWire(db, section)) };
}

function validateSyncTrigger(value: unknown): SyncTriggerPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['feedId', 'sectionId'], 'payload');
  return {
    feedId: optionalNumber(payload.feedId, 'payload.feedId', { integer: true, min: 1 }),
    sectionId: optionalNumber(payload.sectionId, 'payload.sectionId', { integer: true, min: 1 }),
  };
}

function validateSectionCreate(value: unknown): SectionCreatePayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['name', 'key', 'position'], 'payload');
  return {
    name: stringValue(payload.name, 'payload.name', { min: 1, max: 120 }),
    key: optionalString(payload.key, 'payload.key', { min: 1, max: 80 }),
    position: optionalNumber(payload.position, 'payload.position', { integer: true, min: 0 }),
  };
}

function validateSectionUpdate(value: unknown): SectionUpdatePayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['sectionId', 'name', 'position'], 'payload');
  return {
    sectionId: numberValue(payload.sectionId, 'payload.sectionId', { integer: true, min: 1 }),
    name: optionalString(payload.name, 'payload.name', { min: 1, max: 120 }),
    position: optionalNumber(payload.position, 'payload.position', { integer: true, min: 0 }),
  };
}

function validateSectionDelete(value: unknown): SectionDeletePayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['sectionId'], 'payload');
  return { sectionId: numberValue(payload.sectionId, 'payload.sectionId', { integer: true, min: 1 }) };
}

function validateSectionReorder(value: unknown): SectionReorderPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['sectionIds'], 'payload');
  if (!Array.isArray(payload.sectionIds)) throw new Error('payload.sectionIds must be an array');
  return { sectionIds: payload.sectionIds.map((id, index) => numberValue(id, `payload.sectionIds[${index}]`, { integer: true, min: 1 })) };
}

function validateFeedAdd(value: unknown): FeedAddToSectionPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['sectionId', 'url', 'fetchIntervalMinutes', 'enabled'], 'payload');
  return {
    sectionId: numberValue(payload.sectionId, 'payload.sectionId', { integer: true, min: 1 }),
    url: assertValidFeedUrl(stringValue(payload.url, 'payload.url', { min: 1, max: 2048 })),
    fetchIntervalMinutes: optionalNumber(payload.fetchIntervalMinutes, 'payload.fetchIntervalMinutes', { integer: true, min: 1, max: 1440 }),
    enabled: optionalBoolean(payload.enabled, 'payload.enabled'),
  };
}

function validateFeedUpdate(value: unknown): FeedUpdatePayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['feedId', 'enabled', 'muted', 'fetchIntervalMinutes'], 'payload');
  return {
    feedId: numberValue(payload.feedId, 'payload.feedId', { integer: true, min: 1 }),
    enabled: optionalBoolean(payload.enabled, 'payload.enabled'),
    muted: optionalBoolean(payload.muted, 'payload.muted'),
    fetchIntervalMinutes: payload.fetchIntervalMinutes === null ? null : optionalNumber(payload.fetchIntervalMinutes, 'payload.fetchIntervalMinutes', { integer: true, min: 1, max: 1440 }),
  };
}

function validateFeedRemove(value: unknown): FeedRemoveFromSectionPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['sectionId', 'feedId'], 'payload');
  return {
    sectionId: numberValue(payload.sectionId, 'payload.sectionId', { integer: true, min: 1 }),
    feedId: numberValue(payload.feedId, 'payload.feedId', { integer: true, min: 1 }),
  };
}

function validateFeedTest(value: unknown): FeedTestPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['url'], 'payload');
  return { url: assertValidFeedUrl(stringValue(payload.url, 'payload.url', { min: 1, max: 2048 })) };
}

function validateItemsQuery(value: unknown): ItemsQueryPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['sectionId', 'all', 'limit', 'before', 'includeSeen', 'query', 'feedId', 'importantOnly', 'unreadOnly', 'publishedAfter', 'publishedBefore'], 'payload');
  return {
    sectionId: numberValue(payload.sectionId, 'payload.sectionId', { integer: true, min: -1 }),
    all: optionalBoolean(payload.all, 'payload.all'),
    limit: optionalNumber(payload.limit, 'payload.limit', { integer: true, min: 1, max: 200 }),
    before: payload.before === null ? null : optionalString(payload.before, 'payload.before', { min: 1, max: 80 }),
    includeSeen: optionalBoolean(payload.includeSeen, 'payload.includeSeen'),
    query: optionalString(payload.query, 'payload.query', { min: 1, max: 200 }),
    feedId: optionalNumber(payload.feedId, 'payload.feedId', { integer: true, min: 1 }),
    importantOnly: optionalBoolean(payload.importantOnly, 'payload.importantOnly'),
    unreadOnly: optionalBoolean(payload.unreadOnly, 'payload.unreadOnly'),
    publishedAfter: payload.publishedAfter === null ? null : optionalString(payload.publishedAfter, 'payload.publishedAfter', { min: 1, max: 40 }),
    publishedBefore: payload.publishedBefore === null ? null : optionalString(payload.publishedBefore, 'payload.publishedBefore', { min: 1, max: 40 }),
  };
}

function validateItemId(value: unknown): MarkItemReadPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['itemId'], 'payload');
  return { itemId: numberValue(payload.itemId, 'payload.itemId', { integer: true, min: 1 }) };
}

function validateMarkItemsSeen(value: unknown) {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['itemIds'], 'payload');
  if (!Array.isArray(payload.itemIds)) throw new Error('payload.itemIds must be an array');
  return { itemIds: payload.itemIds.map((id, index) => numberValue(id, `payload.itemIds[${index}]`, { integer: true, min: 1 })) };
}

function validateMarkSectionSeen(value: unknown) {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['sectionId'], 'payload');
  return { sectionId: numberValue(payload.sectionId, 'payload.sectionId', { integer: true, min: 1 }) };
}

function validateImportantQuery(value: unknown) {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['limit', 'before'], 'payload');
  return {
    limit: optionalNumber(payload.limit, 'payload.limit', { integer: true, min: 1, max: 200 }),
    before: payload.before === null ? null : optionalString(payload.before, 'payload.before', { min: 1, max: 80 }),
  };
}

function validateLayoutSet(value: unknown): LayoutSetPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['layout'], 'payload');
  return { layout: layoutValue(payload.layout) };
}

function validateOpmlImport(value: unknown): OpmlImportPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['opml', 'sectionId'], 'payload');
  return {
    opml: stringValue(payload.opml, 'payload.opml', { min: 1, max: 5_000_000 }),
    sectionId: optionalNumber(payload.sectionId, 'payload.sectionId', { integer: true, min: 1 }),
  };
}

function sendSyncProgress(event: unknown, progress: Record<string, unknown>) {
  const sender = (event as { sender?: { send?: (channel: string, payload: unknown) => void } })?.sender;
  sender?.send?.('sync:progress', progress);
}
function validateExternalOpen(value: unknown): ExternalOpenPayload {
  const payload = optionalPayload(value);
  rejectUnknown(payload, ['url'], 'payload');
  const url = stringValue(payload.url, 'payload.url', { min: 1, max: 2048 });
  if (!isAllowedExternalUrl(url)) throw new Error('payload.url must be http(s)');
  return { url };
}

export function registerIpcHandlers(ipc: IpcMainLike) {
  handleValidated(ipc, 'sections:list', () => ({}), passthroughResponse, () => listSectionsResponse());

  handleValidated(ipc, 'sections:create', validateSectionCreate, passthroughResponse, (payload) => {
    const db = getDb();
    const section = createSection(db, payload.name, payload.position, payload.key);
    return { section: sectionWire(db, section), changed: 1 };
  });

  handleValidated(ipc, 'sections:update', validateSectionUpdate, passthroughResponse, (payload) => {
    const db = getDb();
    const section = updateSection(db, payload.sectionId, { name: payload.name, position: payload.position });
    return { section: section ? sectionWire(db, section) : undefined, changed: section ? 1 : 0 };
  });

  handleValidated(ipc, 'sections:delete', validateSectionDelete, passthroughResponse, (payload) => {
    const changed = deleteSection(getDb(), payload.sectionId);
    return { changed };
  });

  handleValidated(ipc, 'sections:reorder', validateSectionReorder, passthroughResponse, (payload) => {
    reorderSections(getDb(), payload.sectionIds);
    return { changed: payload.sectionIds.length };
  });

  handleValidated(ipc, 'feeds:addToSection', validateFeedAdd, passthroughResponse, async (payload) => {
    const resolved = await resolveFeedInput(payload.url);
    if (resolved.status !== 'ok') throw new Error(resolved.error.message);
    const db = getDb();
    const result = db.transaction(() => {
      const section = db.prepare('SELECT id FROM sections WHERE id=?').get(payload.sectionId);
      if (!section) throw new Error(`Section ${payload.sectionId} does not exist`);
      const created = createFeed(db, resolved.feedUrl, { title: resolved.title, siteUrl: resolved.site_url });
      const feed = payload.enabled !== undefined || payload.fetchIntervalMinutes !== undefined
        ? updateFeedSettings(db, created.id, {
            enabled: payload.enabled,
            fetchIntervalMinutes: payload.fetchIntervalMinutes,
          }) ?? created
        : created;
      const changed = assignFeedToSection(db, feed.id, payload.sectionId);
      return { feed, changed };
    })();
    log.info('feed added', { feedId: result.feed.id, sectionId: payload.sectionId, discovered: resolved.discovered, mappingCreated: result.changed === 1 });
    return { feed: feedWire(db, result.feed), changed: result.changed };
  });

  handleValidated(ipc, 'feeds:update', validateFeedUpdate, passthroughResponse, (payload) => {
    const feed = updateFeedSettings(getDb(), payload.feedId, { enabled: payload.enabled, muted: payload.muted, fetchIntervalMinutes: payload.fetchIntervalMinutes });
    return { feed: feed ? feedWire(getDb(), feed) : undefined, changed: feed ? 1 : 0 };
  });

  handleValidated(ipc, 'feeds:removeFromSection', validateFeedRemove, passthroughResponse, (payload) => {
    unassignFeedFromSection(getDb(), payload.feedId, payload.sectionId);
    return { changed: 1 };
  });

  handleValidated(ipc, 'feeds:test', validateFeedTest, passthroughResponse, async (payload) => {
    const result = await resolveFeedInput(payload.url);
    if (result.status === 'error') return result;
    return {
      status: 'ok',
      feedUrl: result.feedUrl,
      discovered: result.discovered,
      title: result.title ?? null,
      site_url: result.site_url ?? null,
    };
  });

  handleValidated(ipc, 'application:quit', (value) => {
    const payload = optionalPayload(value);
    rejectUnknown(payload, [], 'payload');
    return {};
  }, passthroughResponse, (_payload, event) => {
    const owner = (event as { sender?: { getOwnerBrowserWindow?: () => { close(): void } | null } })
      ?.sender?.getOwnerBrowserWindow?.();
    setImmediate(() => owner?.close());
    return { closing: true as const };
  });

  handleValidated(ipc, 'sync:trigger', validateSyncTrigger, passthroughResponse, async (payload, event) => {
    const progress = (value: SyncProgress) =>
      sendSyncProgress(event, { ...value, ...(payload.sectionId ? { sectionId: payload.sectionId } : {}) });
    if (typeof payload.feedId === 'number') return syncFeeds(getDb(), [payload.feedId], 'feed', undefined, progress);
    if (typeof payload.sectionId === 'number') return syncSection(getDb(), payload.sectionId, undefined, progress);
    return syncAllFeeds(getDb(), undefined, progress);
  });

  handleValidated(ipc, 'items:query', validateItemsQuery, passthroughResponse, (payload) => {
    const db = getDb();
    const includeSeen = payload.includeSeen ?? getShowSeen(db);
    const items = getItemsBySection(db, payload.sectionId, {
      includeSeen, all: payload.all, limit: payload.limit, before: payload.before ?? null, query: payload.query, feedId: payload.feedId,
      importantOnly: payload.importantOnly, unreadOnly: payload.unreadOnly,
      publishedAfter: payload.publishedAfter ?? null, publishedBefore: payload.publishedBefore ?? null,
    });
    return { items };
  });

  handleValidated(ipc, 'items:markSeen', validateMarkItemsSeen, passthroughResponse, (payload) => ({ changed: markItemsSeen(getDb(), payload.itemIds) }));
  handleValidated(ipc, 'sections:markSeen', validateMarkSectionSeen, passthroughResponse, (payload) => ({ changed: markSectionSeen(getDb(), payload.sectionId) }));
  handleValidated(ipc, 'items:markRead', validateItemId, passthroughResponse, (payload) => ({ changed: markItemRead(getDb(), payload.itemId) }));
  handleValidated(ipc, 'item:markRead', validateItemId, passthroughResponse, (payload) => ({ changed: markItemRead(getDb(), payload.itemId) }));
  handleValidated(ipc, 'items:toggleImportant', validateItemId, passthroughResponse, (payload) => ({ is_important: toggleItemImportant(getDb(), payload.itemId) }));
  handleValidated(ipc, 'item:toggleImportant', validateItemId, passthroughResponse, (payload) => ({ is_important: toggleItemImportant(getDb(), payload.itemId) }));

  handleValidated(ipc, 'items:important', validateImportantQuery, passthroughResponse, (payload) => {
    const db = getDb();
    const limit = Math.max(1, Math.min(200, payload?.limit ?? 50));
    const beforeClause = payload?.before ? 'AND i.published_at < @before' : '';
    const stmt = db.prepare(
      `SELECT i.*, f.title AS feed_title, f.site_url,
              COALESCE(s.is_read, 0) AS is_read,
              COALESCE(s.is_important, 0) AS is_important,
              s.read_at
       FROM items i
       JOIN feeds f ON f.id = i.feed_id
       JOIN item_state s ON s.item_id = i.id AND s.is_important = 1
       WHERE 1=1 ${beforeClause}
       ORDER BY COALESCE(i.published_at, i.created_at) DESC
       LIMIT @limit`
    );
    const items = stmt.all({ limit, before: payload?.before ?? null }) as ItemRow[];
    return { items };
  });

  handleValidated(ipc, 'portability:exportOpml', () => ({}), passthroughResponse, () => ({ opml: exportOpml(getDb()) }));
  handleValidated(ipc, 'portability:importOpml', validateOpmlImport, passthroughResponse, (payload) => {
    const result = importOpml(getDb(), payload.opml, payload.sectionId);
    log.info('OPML imported', result);
    return result;
  });
  handleValidated(ipc, 'portability:backup', () => ({}), passthroughResponse, async () => ({
    filePath: await exportDatabaseBackup(getDb()),
  }));
  handleValidated(ipc, 'diagnostics:export', () => ({}), passthroughResponse, () => exportDiagnostics(getDb()));
  handleValidated(ipc, 'layout:get', () => ({}), passthroughResponse, () => ({ layout: getLayout(getDb()) }));
  handleValidated(ipc, 'layout:set', validateLayoutSet, passthroughResponse, (payload) => {
    setLayout(getDb(), payload.layout);
    return { layout: getLayout(getDb()) };
  });

  handleValidated(ipc, 'shell:openExternal', validateExternalOpen, passthroughResponse, async (payload) => {
    if (!electronShell?.openExternal) return { opened: false };
    await electronShell.openExternal(payload.url);
    return { opened: true };
  });
}

export {};
