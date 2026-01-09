import { getDb } from '../core/storage/db';
import { listFeeds, type Feed } from '../core/storage/dao/feedsDao';
import { syncFeedByUrl, type SyncResult } from '../core/rss/sync';
import { withModule } from './logging';
import { tryLockFeed, markFeedFetched, markFeedError } from '../core/storage/dao/feedsDao';

type SchedulerState = 'stopped' | 'running';

const log = withModule('scheduler');

// Policy
const DEFAULT_INTERVAL_MINUTES = 30;
const MIN_INTERVAL_MINUTES = 10;
const TICK_MS = 60_000; // single global tick

function minutesToMs(m: number) {
  return m * 60 * 1000;
}

function parseIsoOrNull(s?: string | null): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function nextDueAt(feed: Feed): number {
  const last = parseIsoOrNull(feed.last_fetched_at ?? null);
  const raw = feed.fetch_interval_minutes ?? DEFAULT_INTERVAL_MINUTES;
  const interval = Math.max(MIN_INTERVAL_MINUTES, raw);
  if (!last) return 0; // due immediately if never fetched
  return last + minutesToMs(interval);
}

export class Scheduler {
  private state: SchedulerState = 'stopped';
  private timer: NodeJS.Timeout | null = null;
  private inFlight = new Set<number>();

  // Start once at app bootstrap; continues on a single global timer
  start() {
    if (this.state === 'running') return;
    this.state = 'running';
    log.info('start');
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick(); // run immediately
  }

  // Stop on app quit
  stop() {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    log.info('stop');
  }

  isRunning() {
    return this.state === 'running';
  }

  private async tick() {
    if (this.state !== 'running') return;

    const db = getDb();
    const feeds = listFeeds(db, { limit: 1000, offset: 0 }).filter((f) => f.is_enabled === 1);

    const now = Date.now();
    for (const feed of feeds) {
      const dueAt = nextDueAt(feed);
      if (dueAt > now) continue;

      if (!tryLockFeed(db, feed.id)) continue;

      this.inFlight.add(feed.id);
      void this.fetchOne(feed).finally(() => this.inFlight.delete(feed.id));
    }
  }

  // Robust per-feed fetch; never throws
  private async fetchOne(feed: Feed): Promise<SyncResult> {
    const db = getDb();
    const started = Date.now();

    try {
      const res = await syncFeedByUrl(db, feed.url);
      log.info('sync_complete', { feedId: feed.id, status: res.status, newItems: res.newItems });

      // Warn if feed is not mapped to any section (does not block ingestion)
      try {
        const mapped = !!db.prepare(`SELECT 1 FROM feed_sections WHERE feed_id=? LIMIT 1`).get(feed.id);
        if (!mapped) {
          log.warn('unmapped_feed', { feedId: feed.id, url: feed.url });
        }
      } catch (e) {
        // If mapping table not present or query fails, warn and continue
        log.warn('mapping_check_failed', { feedId: feed.id, error: e instanceof Error ? e.message : String(e) });
      }

      return res;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log.error('sync_exception', { feedId: feed.id, error: errMsg });

      // Ensure failure is recorded and last_error updated even if sync threw before logging
      try {
        const duration = Date.now() - started;
        db.prepare(
          `INSERT INTO fetch_log (feed_id, status, http_status, fetched_at, duration_ms, message)
           VALUES (@feed_id, 'error', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), @duration_ms, @message)`
        ).run({ feed_id: feed.id, duration_ms: duration, message: errMsg });

        db.prepare(
          `UPDATE feeds
             SET last_fetched_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 last_error=@err
           WHERE id=@id`
        ).run({ id: feed.id, err: errMsg });
      } catch (logErr) {
        // Swallow to avoid cascading failures
        log.warn('post_error_logging_failed', {
          feedId: feed.id,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      markFeedError(db, feed.id, errMsg);
      return { status: 'error', newItems: 0 };

    }
  }
}

export const scheduler = new Scheduler();

// Public API (for bootstrap). Existing imports of `scheduler` can remain.
export function startScheduler() {
  scheduler.start();
}
export function stopScheduler() {
  scheduler.stop();
}

export {};