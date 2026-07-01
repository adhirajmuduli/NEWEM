import { describe, expect, it } from 'vitest';
import { MAX_SCHEDULER_CONCURRENCY, nextDueAt, runWithConcurrency } from '../../app/main/scheduler';

describe('scheduler concurrency', () => {
  it('never runs more than the configured number of feed workers', async () => {
    let active = 0;
    let maximum = 0;
    const completed: number[] = [];

    await runWithConcurrency(Array.from({ length: 20 }, (_, index) => index), MAX_SCHEDULER_CONCURRENCY, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      completed.push(value);
      active -= 1;
    });

    expect(maximum).toBe(MAX_SCHEDULER_CONCURRENCY);
    expect(completed).toHaveLength(20);
  });

  it('honors a one-minute configured interval without silently clamping it', () => {
    const fetchedAt = '2026-06-29T10:00:00.000Z';
    expect(nextDueAt({ last_fetched_at: fetchedAt, fetch_interval_minutes: 1 } as any))
      .toBe(Date.parse(fetchedAt) + 60_000);
  });});
