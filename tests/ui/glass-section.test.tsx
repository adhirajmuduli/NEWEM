// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionPanel } from '../../app/renderer/components/SectionPanel';
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
  description: 'A local article summary.', published_at: '2026-06-28T00:00:00.000Z',
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

describe('glass section work surface', () => {
  let root: Root;

  afterEach(() => {
    root?.unmount();
    vi.restoreAllMocks();
  });

  it('renders independent source and article panes with collapsible sources', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(panel()));

    expect(document.querySelector('.section-content')).toBeTruthy();
    expect(document.querySelector('.feed-source-rail.open')).toBeTruthy();
    expect(document.querySelector('.section-feed-window')).toBeTruthy();
    expect(document.querySelector('.bento-grid')).toBeTruthy();
    const glassCard = document.querySelector('.magic-card.item-card') as HTMLElement;
    expect(glassCard).toBeTruthy();
    expect(glassCard.style.backdropFilter).toContain('blur(18px)');
    expect(document.querySelectorAll('.gradient-blur').length).toBeGreaterThanOrEqual(2);

    const collapse = document.querySelector('[aria-label="Collapse feed sources"]') as HTMLButtonElement;
    await act(async () => collapse.click());
    expect(document.querySelector('.feed-source-rail.collapsed')).toBeTruthy();
    expect(document.querySelector('.feed-chip')).toBeNull();

    const expand = document.querySelector('[aria-label="Expand feed sources"]') as HTMLButtonElement;
    await act(async () => expand.click());
    expect(document.querySelector('.feed-source-rail.open')).toBeTruthy();
    expect(document.querySelector('.feed-chip')).toBeTruthy();
  });

  it('updates spotlight coordinates locally without changing component state', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(panel({ section: { ...section, feeds: [] } })));

    const card = document.querySelector('.magic-card') as HTMLElement;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      x: 10, y: 20, left: 10, top: 20, right: 310, bottom: 220,
      width: 300, height: 200, toJSON: () => ({}),
    });
    await act(async () => card.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 110, clientY: 90 })));

    expect(card.style.getPropertyValue('--magic-x')).toBe('100px');
    expect(card.style.getPropertyValue('--magic-y')).toBe('70px');
  });

  it('defines glass, bento, blur, compact-action, and reduced-motion safeguards', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'styles', 'app.css'), 'utf8');
    expect(css).toContain('backdrop-filter: blur(18px) saturate(145%)');
    expect(css).toContain('background: var(--glass-fill)');
    expect(css).toContain('grid-auto-flow: dense');
    expect(css).toContain('.item-action-button');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});