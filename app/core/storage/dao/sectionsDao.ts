import Database from 'better-sqlite3';

export interface Section {
  id: number;
  name: string;
  position_index: number;
  created_at: string;
  updated_at: string;
}

export function createSection(db: Database.Database, name: string, position?: number) {
  const stmt = db.prepare(
    `INSERT INTO sections(name, position_index) VALUES (?, COALESCE(?, 0))
     ON CONFLICT(name) DO UPDATE SET name=excluded.name
     RETURNING *`
  );
  return stmt.get(name, position ?? null) as Section;
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
  stmt.run(feedId, sectionId);
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

export function listFeedsForSection(db: Database.Database, sectionId: number) {
  const stmt = db.prepare(
    `SELECT f.* FROM feeds f
     JOIN feed_sections fs ON fs.feed_id = f.id
     WHERE fs.section_id = ? AND f.is_enabled = 1
     ORDER BY f.id`
  );
  return stmt.all(sectionId);
}

export {};
