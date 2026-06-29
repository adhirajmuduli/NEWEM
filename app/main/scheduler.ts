import { getDb } from '../core/storage/db';
import { listFeeds, type Feed, tryLockFeed, markFeedError } from '../core/storage/dao/feedsDao';
import { syncFeedByUrl, type SyncResult } from '../core/rss/sync';
import { withModule } from './logging';

type SchedulerState = 'stopped' | 'running';

const log = withModule('scheduler');
const DEFAULT_INTERVAL_MINUTES = 30;
const MIN_INTERVAL_MINUTES = 10;
const TICK_MS = 60_000;
const STARTUP_DELAY_MS = 5_000;
export const MAX_SCHEDULER_CONCURRENCY = 4;

function minutesToMs(minutes: number) {
  return minutes * 60 * 1000;
}

function nextDueAt(feed: Feed) {
  if (!feed.last_fetched_at) return 0;
  const last = Date.parse(feed.last_fetched_at);
  if (Number.isNaN(last)) return 0;
  return last + minutesToMs(Math.max(MIN_INTERVAL_MINUTES, feed.fetch_interval_minutes ?? DEFAULT_INTERVAL_MINUTES));
}

export async function runWithConcurrency<T>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<void>
) {
  const queue = [...values];
  const workerCount = Math.min(Math.max(1, limit), queue.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const value = queue.shift();
      if (value !== undefined) await worker(value);
    }
  }));
}

export class Scheduler {
  private state: SchedulerState = 'stopped';
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private tickInProgress = false;
  private inFlight = new Set<number>();

  start() {
    if (this.state === 'running') return;
    this.state = 'running';
    log.info('start', { startupDelayMs: STARTUP_DELAY_MS, concurrency: MAX_SCHEDULER_CONCURRENCY });
    this.startupTimer = setTimeout(() => void this.runTickSafely(), STARTUP_DELAY_MS);
    this.timer = setInterval(() => void this.runTickSafely(), TICK_MS);
  }

  stop() {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.timer = null;
    this.startupTimer = null;
    log.info('stop');
  }

  isRunning() {
    return this.state === 'running';
  }

  private async runTickSafely() {
    if (this.state !== 'running' || this.tickInProgress) return;
    this.tickInProgress = true;
    try {
      await this.tick();
    } catch (error) {
      log.error('tick_failed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.tickInProgress = false;
    }
  }

  private async tick() {
    const db = getDb();
    const now = Date.now();
    const dueFeeds = listFeeds(db, { limit: 1000, offset: 0 }).filter((feed) =>
      feed.is_enabled === 1 &&
      feed.is_muted !== 1 &&
      !this.inFlight.has(feed.id) &&
      nextDueAt(feed) <= now
    );

    await runWithConcurrency(dueFeeds, MAX_SCHEDULER_CONCURRENCY, async (feed) => {
      if (this.state !== 'running' || !tryLockFeed(db, feed.id)) return;
      this.inFlight.add(feed.id);
      try {
        await this.fetchOne(feed);
      } finally {
        this.inFlight.delete(feed.id);
      }
    });
  }

  private async fetchOne(feed: Feed): Promise<SyncResult> {
    try {
      const result = await syncFeedByUrl(getDb(), feed.url);
      log.info('sync_complete', { feedId: feed.id, status: result.status, newItems: result.newItems });
      const mapped = !!getDb().prepare('SELECT 1 FROM feed_sections WHERE feed_id=? LIMIT 1').get(feed.id);
      if (!mapped) log.warn('unmapped_feed', { feedId: feed.id, url: feed.url });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('sync_exception', { feedId: feed.id, error: message });
      try {
        markFeedError(getDb(), feed.id, message);
      } catch (writeError) {
        log.warn('post_error_logging_failed', {
          feedId: feed.id,
          error: writeError instanceof Error ? writeError.message : String(writeError),
        });
      }
      return {
        status: 'error',
        feedId: feed.id,
        url: feed.url,
        normalizedUrl: feed.url,
        newItems: 0,
        error: { code: 'network_error', message },
      };
    }
  }
}

export const scheduler = new Scheduler();

export function startScheduler() {
  scheduler.start();
}

export function stopScheduler() {
  scheduler.stop();
}