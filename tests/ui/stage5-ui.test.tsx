// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/renderer/components/AppShell';
import type { FeedWire, PreloadApi, SectionWire } from '../../app/shared/ipcTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function feed(id: number, url: string): FeedWire {
  return {
    id,
    url,
    title: `Feed ${id}`,
    site_url: null,
    last_fetched_at: null,
    last_error: null,
    fetch_interval_minutes: 30,
    is_enabled: 1,
    is_muted: 0,
    item_count: 0,
    unread_count: 0,
  };
}

function makeApi() {
  let sections: SectionWire[] = [{ id: 1, key: 'tech', name: 'Tech', position_index: 0, feeds: [] }];
  let nextSectionId = 2;
  let nextFeedId = 1;

  const api: PreloadApi = {
    version: 1,
    listSections: vi.fn(async () => ({ sections })),
    createSection: vi.fn(async ({ name }) => {
      const section = { id: nextSectionId++, key: name.toLowerCase(), name, position_index: sections.length, feeds: [] };
      sections = [...sections, section];
      return { section, changed: 1 };
    }),
    updateSection: vi.fn(async ({ sectionId, name }) => {
      sections = sections.map((section) => section.id === sectionId ? { ...section, name: name || section.name } : section);
      return { section: sections.find((section) => section.id === sectionId), changed: 1 };
    }),
    deleteSection: vi.fn(async ({ sectionId }) => {
      sections = sections.filter((section) => section.id !== sectionId);
      return { changed: 1 };
    }),
    reorderSections: vi.fn(async ({ sectionIds }) => {
      sections = sectionIds.map((id, position_index) => ({ ...sections.find((section) => section.id === id)!, position_index }));
      return { changed: sectionIds.length };
    }),
    addFeedToSection: vi.fn(async ({ sectionId, url }) => {
      const created = feed(nextFeedId++, url);
      sections = sections.map((section) => section.id === sectionId ? { ...section, feeds: [...section.feeds, created] } : section);
      return { feed: created, changed: 1 };
    }),
    updateFeed: vi.fn(async ({ feedId, enabled }) => {
      let updated: FeedWire | undefined;
      sections = sections.map((section) => ({
        ...section,
        feeds: section.feeds.map((row) => {
          if (row.id !== feedId) return row;
          updated = { ...row, is_enabled: enabled ? 1 : 0 };
          return updated;
        }),
      }));
      return { feed: updated, changed: updated ? 1 : 0 };
    }),
    removeFeedFromSection: vi.fn(async ({ sectionId, feedId }) => {
      sections = sections.map((section) => section.id === sectionId ? { ...section, feeds: section.feeds.filter((row) => row.id !== feedId) } : section);
      return { changed: 1 };
    }),
    testFeed: vi.fn(async () => ({ status: 'ok', title: 'Valid Feed', site_url: null })),
    syncTrigger: vi.fn(async () => ({ status: 'ok', scope: 'all', requested: 1, triggered: 1, ok: 1, notModified: 0, errors: 0, newItems: 1, results: [] })),
    queryItems: vi.fn(async () => ({ items: [] })),
    markItemsSeen: vi.fn(async () => ({ changed: 0 })),
    markSectionSeen: vi.fn(async () => ({ changed: 0 })),
    markItemRead: vi.fn(async () => ({ changed: 1 })),
    toggleItemImportant: vi.fn(async () => ({ is_important: 1 })),
    queryImportant: vi.fn(async () => ({ items: [] })),
    getLayout: vi.fn(async () => ({ layout: { mode: 'stack', panels: [], appearance: {} } })),
    setLayout: vi.fn(async ({ layout }) => ({ layout })),
    onSyncProgress: vi.fn(() => () => {}),
    exportOpml: vi.fn(async () => ({ opml: '<opml><body /></opml>' })),
    importOpml: vi.fn(async () => ({ imported: 0, skipped: 0 })),
    exportBackup: vi.fn(async () => ({ filePath: 'backup.db' })),
    exportDiagnostics: vi.fn(async () => ({ filePath: 'diagnostics.json', entries: 0 })),
    openExternal: vi.fn(async () => ({ opened: true })),
  };
  return api;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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

async function click(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent === label) as HTMLButtonElement | undefined;
  expect(button).toBeTruthy();
  await act(async () => button!.click());
  await flush();
}

describe('Stage 5 section and feed UI', () => {
  let root: Root;
  let api: PreloadApi;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="root"></div>';
    api = makeApi();
    (window as any).readit = api;
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(<AppShell />));
    await flush();
  });

  afterEach(() => {
    root.unmount();
    vi.restoreAllMocks();
  });

  it('creates, renames, refreshes, and deletes sections through the preload API', async () => {
    await click('Manage');
    await setInput('New section', 'Science');
    await click('Create');
    expect(api.createSection).toHaveBeenCalledWith({ name: 'Science' });
    await setInput('Rename section', 'Research');
    await click('Rename');
    expect(api.updateSection).toHaveBeenCalled();

    await click('Refresh all');
    expect(api.syncTrigger).toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click('Delete');
    expect(api.deleteSection).toHaveBeenCalled();
  });

  it('requires a successful feed test before adding a feed to a section', async () => {
    await click('Manage');
    await setInput('https://example.com/feed.xml', 'https://example.com/rss.xml');
    await click('Test feed');
    await click('Add feed');

    expect(api.testFeed).toHaveBeenCalledWith({ url: 'https://example.com/rss.xml' });
    expect(api.addFeedToSection).toHaveBeenCalledWith({ sectionId: 1, url: 'https://example.com/rss.xml', fetchIntervalMinutes: 30, enabled: true });
    expect(document.body.textContent).toContain('Feed 1');
  });
});
