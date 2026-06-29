import { describe, expect, it } from 'vitest';
import { MAX_SCHEDULER_CONCURRENCY, runWithConcurrency } from '../../app/main/scheduler';

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
});