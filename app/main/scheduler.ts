import { getDb } from '../core/storage/db';
import { listFeeds, Feed } from '../core/storage/dao/feedsDao';
import { fetchAndIngestFeed, FetchResult } from '../core/rss/fetcher';

type SchedulerState = 'stopped' | 'running';

const DEFAULT_INTERVAL_MINUTES = 30;
const MIN_INTERVAL_MINUTES = 10;
const TICK_MS = 30_000; // 30s

function minutesToMs(m: number) {
  return m * 60 * 1000;
}

function parseIsoOrEpoch(s?: string | null): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function nextDueAt(feed: Feed): number {
  const last = parseIsoOrEpoch(feed.last_fetched_at ?? null);
  const raw = feed.fetch_interval_minutes ?? DEFAULT_INTERVAL_MINUTES;
  const interval = Math.max(MIN_INTERVAL_MINUTES, raw);
  if (!last) return 0; // due immediately if never fetched
  return last + minutesToMs(interval);
}

export class Scheduler {
  private state: SchedulerState = 'stopped';
  private timer: NodeJS.Timeout | null = null;
  private inFlight = new Set<number>();

  start() {
    if (this.state === 'running') return;
    this.state = 'running';
    console.log(JSON.stringify({ t: new Date().toISOString(), mod: 'scheduler', level: 'info', msg: 'start' }));
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  stop() {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    console.log(JSON.stringify({ t: new Date().toISOString(), mod: 'scheduler', level: 'info', msg: 'stop' }));
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
      if (this.inFlight.has(feed.id)) continue;
      const dueAt = nextDueAt(feed);
      if (dueAt > now) continue;
      this.inFlight.add(feed.id);
      void this.fetchOne(feed).finally(() => this.inFlight.delete(feed.id));
    }
  }

  async fetchOne(feed: Feed): Promise<FetchResult> {
    const db = getDb();
    try {
      const res = await fetchAndIngestFeed(db, feed.id, feed.url, {
        etag: feed.etag ?? undefined,
        last_modified: feed.last_modified ?? undefined,
      });
      console.log(
        JSON.stringify({
          t: new Date().toISOString(),
          mod: 'scheduler',
          level: 'info',
          msg: 'fetch',
          meta: { feedId: feed.id, status: res.status, newItems: res.newItems },
        })
      );
      return res;
    } catch (e) {
      console.log(
        JSON.stringify({
          t: new Date().toISOString(),
          mod: 'scheduler',
          level: 'error',
          msg: 'fetch_error',
          meta: { feedId: feed.id, error: e instanceof Error ? e.message : String(e) },
        })
      );
      return { status: 'error', newItems: 0 };
    }
  }
}

export const scheduler = new Scheduler();

export {};