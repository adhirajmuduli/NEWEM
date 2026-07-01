import { describe, expect, it } from 'vitest';
import { parseFeed } from '../../app/core/rss/parser';

describe('RSS and Atom parser contracts', () => {
  it('preserves every supplied item and canonicalizes publication dates', () => {
    const items = Array.from({ length: 240 }, (_, index) =>
      `<item><guid>${index}</guid><title>Story ${index}</title><link>https://example.com/${index}</link><pubDate>Mon, 29 Jun 2026 12:${String(index % 60).padStart(2, '0')}:00 GMT</pubDate></item>`
    ).join('');
    const parsed = parseFeed(`<?xml version="1.0"?><rss><channel><title>Source</title><link>https://example.com</link>${items}</channel></rss>`);

    expect(parsed.items).toHaveLength(240);
    expect(parsed.items[0].publishedAt).toBe('2026-06-29T12:00:00.000Z');
    expect(parsed.items.every((item) => item.publishedAt?.endsWith('Z'))).toBe(true);
  });

  it('keeps ordinary letters while reducing feed markup to text', () => {
    const parsed = parseFeed(`<?xml version="1.0"?><rss><channel><title>Source</title><link>https://example.com</link><item><title>Questions across sources</title><link>https://example.com/a</link><description><![CDATA[<p>Questions across sources stay visible.</p>]]></description></item></channel></rss>`);
    expect(parsed.items[0].description).toBe('Questions across sources stay visible.');
  });
});
