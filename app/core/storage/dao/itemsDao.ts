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
    `UPDATE items SET seen_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND seen_at IS NULL`
  );
  const tx = db.transaction((ids: number[]) => {
    let changed = 0;
    for (const id of ids) {
      const r = stmt.run(id);
      changed += r.changes;
    }
    return changed;
  });
  return tx(itemIds) as number;
}

export function markSectionSeen(db: Database.Database, sectionId: number) {
  const r = db.prepare(
    `UPDATE items SET seen_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE seen_at IS NULL AND feed_id IN (
       SELECT fs.feed_id FROM feed_sections fs WHERE fs.section_id=?
     )`
  ).run(sectionId);
  return r.changes;
}
/**
 * Step 9: Mark a single item as read (idempotent).
 * Sets is_read=1 and read_at=now; preserves important flag.
 */
export function markItemRead(db: Database.Database, itemId: number) {
  const r = db.prepare(
    `INSERT INTO item_state(item_id, is_read, read_at)
     VALUES (@itemId, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(item_id) DO UPDATE SET
       is_read=1,
       read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ).run({ itemId });
  return r.changes;
}
/**
 * Step 9: Toggle item important flag. Returns the new is_important value (0|1).
 */
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
  opts?: { includeSeen?: boolean; limit?: number; before?: string | null }
) {
  const includeSeen = opts?.includeSeen ?? false;
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const beforeClause = opts?.before ? 'AND i.published_at < @before' : '';

  // Step 9 visibility semantics
  const visibilityClause = includeSeen
    ? ''
    : `AND (
         COALESCE(s.is_important, 0) = 1
         OR (COALESCE(s.is_read, 0) = 0 AND i.seen_at IS NULL)
       )`;

  const stmt = db.prepare(
    `SELECT i.*, f.title AS feed_title, f.site_url
     FROM items i
     JOIN feeds f ON f.id = i.feed_id
     LEFT JOIN item_state s ON s.item_id = i.id
     WHERE i.feed_id IN (
       SELECT fs.feed_id FROM feed_sections fs WHERE fs.section_id=@sectionId
     )
     ${visibilityClause}
     ${beforeClause}
     ORDER BY COALESCE(i.published_at, i.created_at) DESC
     LIMIT @limit`
  );

  return stmt.all({
    sectionId,
    limit,
    before: opts?.before ?? null,
  }) as ItemRow[];
}

console.log("Database DAO initialized successfully!");

export {};
