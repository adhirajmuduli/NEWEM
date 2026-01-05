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

export function getItemsBySection(
  db: Database.Database,
  sectionId: number,
  opts?: { includeSeen?: boolean; limit?: number; before?: string | null }
) {
  const includeSeen = opts?.includeSeen ?? false;
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const beforeClause = opts?.before ? 'AND i.published_at < @before' : '';
  const seenClause = includeSeen ? '' : 'AND i.seen_at IS NULL';
  const stmt = db.prepare(
    `SELECT i.*, f.title AS feed_title, f.site_url
     FROM items i
     JOIN feeds f ON f.id = i.feed_id
     WHERE i.feed_id IN (
       SELECT fs.feed_id FROM feed_sections fs WHERE fs.section_id=@sectionId
     ) ${seenClause} ${beforeClause}
     ORDER BY COALESCE(i.published_at, i.created_at) DESC
     LIMIT @limit`
  );
  const rows = stmt.all({ sectionId, limit, before: opts?.before ?? null }) as ItemRow[];
  return rows;
}

console.log("Database DAO initialized successfully!");

export {};
