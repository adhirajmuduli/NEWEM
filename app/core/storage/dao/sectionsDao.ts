import Database from 'better-sqlite3';

export interface Section {
  id: number;
  key: string;
  name: string;
  position_index: number;
  created_at: string;
  updated_at: string;
}

export function sectionKeyFromName(name: string) {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || `section_${Date.now()}`;
}

function nextPosition(db: Database.Database) {
  const row = db.prepare(`SELECT COALESCE(MAX(position_index), -1) + 1 AS position FROM sections`).get() as {
    position: number;
  };
  return row.position;
}

export function createSection(db: Database.Database, name: string, position?: number, key?: string) {
  const stableKey = key ?? sectionKeyFromName(name);
  const stmt = db.prepare(
    `INSERT INTO sections(key, name, position_index)
     VALUES (@key, @name, @position)
     ON CONFLICT(key) DO UPDATE SET
       name=excluded.name,
       position_index=excluded.position_index,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     RETURNING *`
  );
  return stmt.get({ key: stableKey, name, position: position ?? nextPosition(db) }) as Section;
}

export function updateSection(db: Database.Database, id: number, updates: { name?: string; position?: number }) {
  const current = db.prepare(`SELECT * FROM sections WHERE id=?`).get(id) as Section | undefined;
  if (!current) return undefined;
  const nextName = updates.name ?? current.name;
  const nextPositionIndex = updates.position ?? current.position_index;
  return db.prepare(
    `UPDATE sections
     SET name=@name, position_index=@position, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=@id
     RETURNING *`
  ).get({ id, name: nextName, position: nextPositionIndex }) as Section;
}

export function deleteSection(db: Database.Database, id: number) {
  const r = db.prepare(`DELETE FROM sections WHERE id=?`).run(id);
  return r.changes;
}

export function listSections(db: Database.Database) {
  const stmt = db.prepare(`SELECT * FROM sections ORDER BY position_index, id`);
  return stmt.all() as Section[];
}

export function reorderSections(db: Database.Database, ids: number[]) {
  const stmt = db.prepare(
    `UPDATE sections SET position_index=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`
  );
  const tx = db.transaction((arr: number[]) => {
    let pos = 0;
    for (const id of arr) stmt.run(pos++, id);
  });
  tx(ids);
}

export function assignFeedToSection(db: Database.Database, feedId: number, sectionId: number) {
  const stmt = db.prepare(
    `INSERT INTO feed_sections(feed_id, section_id) VALUES (?, ?)
     ON CONFLICT(feed_id, section_id) DO NOTHING`
  );
  return stmt.run(feedId, sectionId).changes;
}

export function unassignFeedFromSection(db: Database.Database, feedId: number, sectionId: number) {
  const stmt = db.prepare(`DELETE FROM feed_sections WHERE feed_id=? AND section_id=?`);
  stmt.run(feedId, sectionId);
}

export function listSectionsForFeed(db: Database.Database, feedId: number) {
  const stmt = db.prepare(
    `SELECT s.* FROM sections s
     JOIN feed_sections fs ON fs.section_id = s.id
     WHERE fs.feed_id = ?
     ORDER BY s.position_index, s.id`
  );
  return stmt.all(feedId) as Section[];
}

export function listFeedsForSection(db: Database.Database, sectionId: number, opts?: { enabledOnly?: boolean }) {
  const enabledClause = opts?.enabledOnly ? 'AND f.is_enabled = 1 AND COALESCE(f.is_muted, 0) = 0' : '';
  const stmt = db.prepare(
    `SELECT f.* FROM feeds f
     JOIN feed_sections fs ON fs.feed_id = f.id
     WHERE fs.section_id = ? ${enabledClause}
     ORDER BY f.id`
  );
  return stmt.all(sectionId);
}

export {};
