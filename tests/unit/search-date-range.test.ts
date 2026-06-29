import { describe, expect, it } from 'vitest';
import { exactLocalDayRange, relativeDateRange } from '../../app/renderer/utils/dateRange';

describe('search date ranges', () => {
  it('creates exact local-day inclusive bounds', () => {
    const selected = new Date(2026, 5, 14, 16, 30);
    expect(exactLocalDayRange(selected)).toEqual({
      publishedAfter: new Date(2026, 5, 14).toISOString(),
      publishedBefore: new Date(new Date(2026, 5, 15).getTime() - 1).toISOString(),
    });
  });

  it('creates relative ranges and leaves unrestricted modes empty', () => {
    const now = Date.UTC(2026, 5, 29);
    expect(relativeDateRange('7', now)).toEqual({
      publishedAfter: new Date(now - 7 * 86_400_000).toISOString(),
    });
    expect(relativeDateRange('')).toEqual({});
    expect(relativeDateRange('custom')).toEqual({});
  });
});