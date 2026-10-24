import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseFeed, type ParsedItem } from '../../app/core/rss/parser';

const VALID_SKELETON =
  '<?xml version="1.0"?><rss><channel><title>Example</title><link>https://example.com</link>' +
  '<item><guid>g1</guid><title>Item one</title><link>https://example.com/one</link>' +
  '<description>Body</description><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>';

const mutatedSkeleton = fc
  .tuple(
    fc.integer({ min: 0, max: VALID_SKELETON.length }),
    fc.string({ maxLength: 48 }),
    fc.integer({ min: 0, max: 3 })
  )
  .map(([offset, payload, mode]) => {
    if (mode === 0) return VALID_SKELETON.slice(0, offset) + payload + VALID_SKELETON.slice(offset);
    if (mode === 1) return VALID_SKELETON.slice(0, offset);
    if (mode === 2) return VALID_SKELETON.slice(offset);
    return payload + VALID_SKELETON;
  });

function expectStructuredOutcome(input: string) {
  let parsed: ReturnType<typeof parseFeed> | null = null;
  try {
    parsed = parseFeed(input);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return;
  }
  expect(Array.isArray(parsed.items)).toBe(true);
  for (const entry of parsed.items) {
    const item = entry as ParsedItem;
    expect(typeof item.link).toBe('string');
    expect(item.link.length).toBeGreaterThan(0);
    if (item.publishedAt !== undefined && item.publishedAt !== null) {
      expect(Number.isNaN(Date.parse(item.publishedAt))).toBe(false);
    }
  }
}

describe('feed parser fuzz', () => {
  it('survives arbitrary input without crashing or throwing non-Error values', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (input) => {
        expectStructuredOutcome(input);
      }),
      { numRuns: 200 }
    );
  });

  it('survives mutations of a valid feed skeleton with structured outcomes', () => {
    fc.assert(
      fc.property(mutatedSkeleton, (input) => {
        expectStructuredOutcome(input);
      }),
      { numRuns: 200 }
    );
  });

  it('strips HTML element tags from CDATA descriptions', () => {
    const cdataFeed = fc
      .string({ maxLength: 300 })
      .filter((value) => !value.includes(']]>'))
      .map((content) =>
        '<?xml version="1.0"?><rss><channel><title>Example</title><link>https://example.com</link>' +
        '<item><guid>g</guid><title>Item</title><link>https://example.com/x</link>' +
        `<description><![CDATA[${content}]]></description></item></channel></rss>`
      );
    fc.assert(
      fc.property(cdataFeed, (xml) => {
        let parsed: ReturnType<typeof parseFeed>;
        try {
          parsed = parseFeed(xml);
        } catch {
          return true;
        }
        expect(parsed.items).toHaveLength(1);
        const description = parsed.items[0].description ?? '';
        expect(description).not.toMatch(/<[a-zA-Z][^>]*>/);
      }),
      { numRuns: 200 }
    );
  });
});
