import Database from 'better-sqlite3';
import path from 'path';
import { syncFeedByUrl } from '../app/core/rss/sync';

// IMPORTANT: use same DB location logic as app
const dbPath = path.join(process.cwd(), 'data', 'app.db');
const db = new Database(dbPath);

(async () => {
  const feedUrl = 'https://hnrss.org/frontpage'; // real, reliable feed

  const result = await syncFeedByUrl(db, feedUrl);

  console.log('Sync result:', result);

  db.close();
})();
