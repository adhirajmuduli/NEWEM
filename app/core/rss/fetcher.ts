import Database from 'better-sqlite3';
import { syncFeedById, type SyncResult } from './sync';

export type FetchResult = Pick<SyncResult, 'status' | 'newItems'>;

export async function fetchAndIngestFeed(
  db: Database.Database,
  feedId: number,
  _url: string,
  _cache: { etag?: string | null; last_modified?: string | null }
): Promise<FetchResult> {
  const result = await syncFeedById(db, feedId);
  return { status: result.status, newItems: result.newItems };
}