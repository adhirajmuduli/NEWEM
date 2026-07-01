// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/renderer/components/AppShell';
import type { FeedWire, ItemWire, PreloadApi, SectionWire } from '../../app/shared/ipcTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function click(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent === text) as HTMLButtonElement | undefined;
  expect(button).toBeTruthy();
  await act(async () => button!.click());
  await flush();
}

async function setInput(placeholder: string, value: string) {
  const input = Array.from(document.querySelectorAll('input')).find((node) => node.placeholder === placeholder) as HTMLInputElement | undefined;
  expect(input).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input!.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  });
  await flush();
}

describe('Stage 5 e2e user-managed feed flow', () => {
  let root: Root;
  let sections: SectionWire[];
  let items: ItemWire[];

  beforeEach(async () => {
    sections = [];
    items = [];
    const api: PreloadApi = {
      version: 1,
      listSections: vi.fn(async () => ({ sections })),
      createSection: vi.fn(async ({ name }) => {
        const section: SectionWire = { id: 1, key: 'research', name, position_index: 0, feeds: [] };
        sections = [section];
        return { section, changed: 1 };
      }),
      updateSection: vi.fn(async () => ({ changed: 1 })),
      deleteSection: vi.fn(async () => ({ changed: 1 })),
      reorderSections: vi.fn(async ({ sectionIds }) => ({ changed: sectionIds.length })),
      addFeedToSection: vi.fn(async ({ url }) => {
        const feed: FeedWire = { id: 1, url, title: 'Mock RSS', site_url: null, last_fetched_at: null, last_error: null, fetch_interval_minutes: 30, is_enabled: 1, is_muted: 0, item_count: 0, unread_count: 0 };
        sections = [{ ...sections[0], feeds: [feed] }];
        return { feed, changed: 1 };
      }),
      updateFeed: vi.fn(async () => ({ changed: 1 })),
      removeFeedFromSection: vi.fn(async () => ({ changed: 1 })),
      testFeed: vi.fn(async () => ({ status: 'ok' as const, title: 'Mock RSS', site_url: null })),
      syncTrigger: vi.fn(async () => {
        items = [{ id: 1, feed_id: 1, link: 'https://example.com/a', title: 'Loaded item', description: 'Body', published_at: null, dedupe_key: 'a', created_at: new Date().toISOString(), feed_title: 'Mock RSS', is_read: 0, is_important: 0 }];
        sections = [{ ...sections[0], feeds: [{ ...sections[0].feeds[0], item_count: 1, unread_count: 1, last_fetched_at: new Date().toISOString() }] }];
        return { status: 'ok' as const, scope: 'section' as const, requested: 1, triggered: 1, ok: 1, notModified: 0, errors: 0, newItems: 1, results: [] };
      }),
      queryItems: vi.fn(async () => ({ items })),
      markItemsSeen: vi.fn(async () => ({ changed: 0 })),
      markSectionSeen: vi.fn(async () => ({ changed: 0 })),
      markItemRead: vi.fn(async () => ({ changed: 1 })),
      toggleItemImportant: vi.fn(async () => ({ is_important: 1 as const })),
      queryImportant: vi.fn(async () => ({ items: [] })),
      getLayout: vi.fn(async () => ({ layout: { mode: 'stack' as const, panels: [], appearance: {} } })),
      setLayout: vi.fn(async ({ layout }) => ({ layout })),
      onSyncProgress: vi.fn(() => () => {}),
    exportOpml: vi.fn(async () => ({ opml: '<opml><body /></opml>' })),
    importOpml: vi.fn(async () => ({ imported: 0, skipped: 0 })),
    exportBackup: vi.fn(async () => ({ filePath: 'backup.db' })),
    exportDiagnostics: vi.fn(async () => ({ filePath: 'diagnostics.json', entries: 0 })),
    openExternal: vi.fn(async () => ({ opened: true })),
    };
    (window as any).readit = api;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(<AppShell />));
    await flush();
  });

  afterEach(() => root.unmount());

  it('creates a section, adds a mocked valid feed, refreshes, and displays items', async () => {
    await click('Manage');
    await setInput('New section', 'Research');
    await click('Create');
    await setInput('https://example.com/feed.xml', 'https://example.com/rss.xml');
    await click('Test feed');
    await click('Add feed');
    await click('Refresh');

    expect(document.body.textContent).toContain('Loaded item');
    expect(document.body.textContent).toContain('1 articles');
  });
});
