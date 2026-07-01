import Database from 'better-sqlite3';

export interface NewItem {
  guid?: string | null;
  link: string;
  title?: string | null;
  description?: string | null;
  published_at?: string | null;
  dedupe_key: string;
}

export interface ItemRow {
  id: number;
  feed_id: number;
  guid?: string | null;
  link: string;
  title?: string | null;
  description?: string | null;
  published_at?: string | null;
  dedupe_key: string;
  seen_at?: string | null;
  created_at: string;
  feed_title?: string | null;
  site_url?: string | null;
  is_read: 0 | 1;
  is_important: 0 | 1;
  read_at?: string | null;
}

export function insertItems(db: Database.Database, feedId: number, items: NewItem[]) {
  const stmt = db.prepare(
    `INSERT INTO items(feed_id, guid, link, title, description, published_at, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(dedupe_key) DO NOTHING`
  );
  const tx = db.transaction((rows: NewItem[]) => {
    let inserted = 0;
    for (const r of rows) {
      const res = stmt.run(
        feedId,
        r.guid ?? null,
        r.link,
        r.title ?? null,
        r.description ?? null,
        r.published_at ?? null,
        r.dedupe_key
      );
      if (res.changes > 0) inserted += 1;
    }
    return inserted;
  });
  return tx(items) as number;
}

export function markSeen(db: Database.Database, itemIds: number[]) {
  const stmt = db.prepare(
    `INSERT INTO item_state(item_id, is_read, read_at)
     VALUES (@itemId, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(item_id) DO UPDATE SET
       is_read=1,
       read_at=CASE
         WHEN item_state.is_read = 1 THEN item_state.read_at
         ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now')
       END
     WHERE item_state.is_read = 0`
  );
  const tx = db.transaction((ids: number[]) => {
    let changed = 0;
    for (const id of ids) {
      const r = stmt.run({ itemId: id });
      changed += r.changes;
    }
    return changed;
  });
  return tx(itemIds) as number;
}

export function markSectionSeen(db: Database.Database, sectionId: number) {
  const itemIds = db.prepare(
    `SELECT i.id
     FROM items i
     LEFT JOIN item_state s ON s.item_id = i.id
     WHERE COALESCE(s.is_read, 0) = 0
       AND i.feed_id IN (SELECT fs.feed_id FROM feed_sections fs WHERE fs.section_id=?)`
  ).all(sectionId) as Array<{ id: number }>;

  return markSeen(db, itemIds.map((row) => row.id));
}

export function markItemRead(db: Database.Database, itemId: number) {
  const r = db.prepare(
    `INSERT INTO item_state(item_id, is_read, read_at)
     VALUES (@itemId, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(item_id) DO UPDATE SET
       is_read=1,
       read_at=CASE
         WHEN item_state.is_read = 1 THEN item_state.read_at
         ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now')
       END
     WHERE item_state.is_read = 0`
  ).run({ itemId });
  return r.changes;
}

export function toggleItemImportant(db: Database.Database, itemId: number): 0 | 1 {
  const row = db.prepare(`SELECT is_important FROM item_state WHERE item_id=?`).get(itemId) as
    | { is_important: number }
    | undefined;
  const next = row && row.is_important ? 0 : 1;
  if (row) {
    db.prepare(`UPDATE item_state SET is_important=@next WHERE item_id=@itemId`).run({ next, itemId });
  } else {
    db.prepare(
      `INSERT INTO item_state (item_id, is_read, is_important)
       VALUES (@itemId, 0, @next)`
    ).run({ itemId, next });
  }
  return next as 0 | 1;
}

export function getItemsBySection(
  db: Database.Database,
  sectionId: number,
  opts?: { includeSeen?: boolean; all?: boolean; limit?: number; before?: string | null; query?: string; feedId?: number; importantOnly?: boolean; unreadOnly?: boolean; publishedAfter?: string | null; publishedBefore?: string | null }
) {
  const includeSeen = opts?.includeSeen ?? false;
  const limit = opts?.all ? null : Math.max(1, Math.min(200, opts?.limit ?? 50));
  const clauses: string[] = [];
  const itemTime = `CASE WHEN i.published_at GLOB '????-??-??T??:??:??*' THEN i.published_at ELSE i.created_at END`;
  if (sectionId > 0) {
    clauses.push(`i.feed_id IN (SELECT fs.feed_id FROM feed_sections fs WHERE fs.section_id=@sectionId)`);
  }
  if (!includeSeen) clauses.push(`(COALESCE(s.is_important, 0) = 1 OR COALESCE(s.is_read, 0) = 0)`);
  if (opts?.unreadOnly) clauses.push(`COALESCE(s.is_read, 0) = 0`);
  if (opts?.importantOnly) clauses.push(`COALESCE(s.is_important, 0) = 1`);
  if (opts?.feedId) clauses.push(`i.feed_id = @feedId`);
  if (opts?.before) clauses.push(`${itemTime} < @before`);
  if (opts?.publishedAfter) clauses.push(`${itemTime} >= @publishedAfter`);
  if (opts?.publishedBefore) clauses.push(`${itemTime} <= @publishedBefore`);
  if (opts?.query?.trim()) clauses.push(`(LOWER(COALESCE(i.title, '')) LIKE @queryLike OR LOWER(COALESCE(i.description, '')) LIKE @queryLike OR LOWER(COALESCE(f.title, '')) LIKE @queryLike)`);
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const stmt = db.prepare(
    `SELECT i.*, f.title AS feed_title, f.site_url,
            COALESCE(s.is_read, 0) AS is_read,
            COALESCE(s.is_important, 0) AS is_important,
            s.read_at
     FROM items i
     JOIN feeds f ON f.id = i.feed_id
     LEFT JOIN item_state s ON s.item_id = i.id
     ${where}
     ORDER BY ${itemTime} DESC, i.id DESC
     ${limit === null ? '' : 'LIMIT @limit'}`
  );

  const parameters: Record<string, string | number> = {};
  if (limit !== null) parameters.limit = limit;
  if (sectionId > 0) parameters.sectionId = sectionId;
  if (opts?.before) parameters.before = opts.before;
  if (opts?.feedId) parameters.feedId = opts.feedId;
  if (opts?.publishedAfter) parameters.publishedAfter = opts.publishedAfter;
  if (opts?.publishedBefore) parameters.publishedBefore = opts.publishedBefore;
  if (opts?.query?.trim()) parameters.queryLike = `%${opts.query.trim().toLowerCase()}%`;
  return stmt.all(parameters) as ItemRow[];
}

export {};
