// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterItemsByDayWindow, SectionPanel } from '../../app/renderer/components/SectionPanel';
import type { FeedWire, ItemWire, SectionWire } from '../../app/shared/ipcTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const feed: FeedWire = {
  id: 7, url: 'https://example.com/rss.xml', title: 'Example', site_url: null,
  last_fetched_at: null, last_error: null, fetch_interval_minutes: 30,
  is_enabled: 1, is_muted: 0, item_count: 1, unread_count: 1,
};
const section: SectionWire = { id: 1, key: 'science', name: 'Science', position_index: 0, feeds: [feed] };
const item: ItemWire = {
  id: 11, feed_id: 7, link: 'https://example.com/article', title: 'Glass article',
  description: '<strong>Questions</strong> across sources stay visible.', published_at: '2026-06-28T00:00:00.000Z',
  dedupe_key: 'glass-article', created_at: '2026-06-28T00:00:00.000Z',
  feed_title: 'Example', is_read: 0, is_important: 0,
};

function panel(overrides: Partial<React.ComponentProps<typeof SectionPanel>> = {}) {
  return (
    <SectionPanel
      section={section}
      items={[item]}
      loading={false}
      error={null}
      warning={null}
      onDayWindowChange={vi.fn()}
      onRefresh={vi.fn()}
      onMarkSeen={vi.fn()}
      openExternalItem={vi.fn()}
      onToggleImportant={vi.fn()}
      onToggleFeed={vi.fn()}
      onToggleMute={vi.fn()}
      onUpdateInterval={vi.fn()}
      onRemoveFeed={vi.fn()}
      {...overrides}
    />
  );
}

describe('section news work surface', () => {
  let root: Root;

  afterEach(() => {
    root?.unmount();
    vi.restoreAllMocks();
  });

  it('renders independent source and article panes with static cards and full bottom fades', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(panel()));

    expect(document.querySelector('.feed-source-rail.collapsed')).toBeTruthy();
    expect(document.querySelector('.feed-chip')).toBeNull();
    expect(document.querySelector('.section-feed-window')).toBeTruthy();
    expect(document.querySelector('.bento-grid')).toBeTruthy();
    expect(document.querySelector('.glass-card.item-card')).toBeTruthy();
    expect(document.querySelector('.magic-card')).toBeNull();
    expect(document.querySelectorAll('.scroll-fade')).toHaveLength(1);
    expect(document.body.textContent).toContain('Questions across sources stay visible.');

    const expand = document.querySelector('[aria-label="Expand feed sources"]') as HTMLButtonElement;
    await act(async () => expand.click());
    expect(document.querySelector('.feed-source-rail.open')).toBeTruthy();
    expect(document.querySelector('.feed-chip')).toBeTruthy();
    expect(document.querySelectorAll('.scroll-fade')).toHaveLength(2);
  });

  it('filters items by a persisted rolling day window without dropping invalid dates', () => {
    const now = Date.parse('2026-06-30T12:00:00.000Z');
    const recent = { ...item, id: 12, published_at: '2026-06-28T00:00:00.000Z' };
    const old = { ...item, id: 13, published_at: '2026-06-01T00:00:00.000Z' };
    const unknown = { ...item, id: 14, published_at: 'unknown', created_at: 'unknown' };

    expect(filterItemsByDayWindow([recent, old, unknown], 7, now).map((row) => row.id)).toEqual([12, 14]);
    expect(filterItemsByDayWindow([recent, old], null, now)).toHaveLength(2);
  });
  it('uses only the title as the open action and places a compact important control in metadata', async () => {
    const onToggleImportant = vi.fn();
    const openExternalItem = vi.fn();
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(panel({ onToggleImportant, openExternalItem })));

    expect([...document.querySelectorAll('button')].some((button) => button.textContent === 'Open')).toBe(false);
    const important = document.querySelector('.important-toggle') as HTMLButtonElement;
    expect(important.textContent).toBe('i');
    await act(async () => important.click());
    expect(onToggleImportant).toHaveBeenCalledWith(1, item);

    const title = document.querySelector('.item-title') as HTMLAnchorElement;
    await act(async () => title.click());
    expect(openExternalItem).toHaveBeenCalledWith(1, item);
  });

  it('renders an uncapped item set incrementally to keep scrolling responsive', async () => {
    const manyItems = Array.from({ length: 161 }, (_, index) => ({
      ...item,
      id: index + 1,
      link: `https://example.com/${index + 1}`,
      dedupe_key: `item-${index + 1}`,
    }));
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(panel({ items: manyItems })));

    expect(document.querySelectorAll('.item-card')).toHaveLength(80);
    const loadMore = document.querySelector('.load-more-items') as HTMLButtonElement;
    await act(async () => loadMore.click());
    expect(document.querySelectorAll('.item-card')).toHaveLength(160);
    await act(async () => (document.querySelector('.load-more-items') as HTMLButtonElement).click());
    expect(document.querySelectorAll('.item-card')).toHaveLength(161);
    expect(document.querySelector('.load-more-items')).toBeNull();
  });
  it('defines static glass, bento, scroll containment, and increased section height', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'styles', 'app.css'), 'utf8');
    expect(css).toContain('.glass-card');
    expect(css).toContain('grid-auto-flow: dense');
    expect(css).toContain('.scroll-fade');
    expect(css).toContain('padding: 0.5cm');
    expect(css).toContain('height: 100%');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('content-visibility: auto');
  });
});
