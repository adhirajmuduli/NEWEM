// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/renderer/components/AppShell';
import type { ItemWire, PreloadApi, SyncCompletedWire, SyncProgressWire } from '../../app/shared/ipcTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function click(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent === text) as HTMLButtonElement;
  expect(button).toBeTruthy();
  return act(async () => {
    button.click();
    await Promise.resolve();
  });
}

describe('Stage 7 renderer workflows', () => {
  let root: Root;

  afterEach(() => {
    root?.unmount();
    vi.restoreAllMocks();
  });

  it('queries local filters, exposes mute controls, and renders sync progress', async () => {
    let progressListener: ((progress: SyncProgressWire) => void) | undefined;
    let completedListener: ((event: SyncCompletedWire) => void) | undefined;
    const api: PreloadApi = {
      version: 2,
      listSections: vi.fn(async () => ({ sections: [{
        id: 1,
        key: 'science',
        name: 'Science',
        position_index: 0,
        feeds: [{
          id: 7, url: 'https://example.com/rss.xml', title: 'Example', site_url: null,
          last_fetched_at: null, last_error: null, fetch_interval_minutes: 30,
          is_enabled: 1 as const, is_muted: 0 as const, item_count: 1, unread_count: 1,
        }],
      }] })),
      createSection: vi.fn(async () => ({ changed: 0 })),
      updateSection: vi.fn(async () => ({ changed: 0 })),
      deleteSection: vi.fn(async () => ({ changed: 0 })),
      reorderSections: vi.fn(async () => ({ changed: 0 })),
      addFeedToSection: vi.fn(async () => ({ changed: 0 })),
      updateFeed: vi.fn(async () => ({ changed: 1 })),
      removeFeedFromSection: vi.fn(async () => ({ changed: 0 })),
      testFeed: vi.fn(async () => ({ status: 'ok' as const })),
      syncTrigger: vi.fn(async () => ({ status: 'ok' as const, scope: 'section' as const, requested: 1, triggered: 1, ok: 1, notModified: 0, errors: 0, newItems: 0, results: [] })),
      onSyncProgress: vi.fn((listener) => { progressListener = listener; return () => { progressListener = undefined; }; }),
      onSyncCompleted: vi.fn((listener) => { completedListener = listener; return () => { completedListener = undefined; }; }),
      queryItems: vi.fn(async () => ({ items: [] })),
      markSectionSeen: vi.fn(async () => ({ changed: 0 })),
      markItemRead: vi.fn(async () => ({ changed: 0 })),
      toggleItemImportant: vi.fn(async () => ({ is_important: 1 as const })),
      getLayout: vi.fn(async () => ({ layout: { mode: 'stack' as const, panels: [], appearance: {} } })),
      setLayout: vi.fn(async ({ layout }) => ({ layout })),
      openExternal: vi.fn(async () => ({ opened: true })),
      exportOpml: vi.fn(async () => ({ opml: '<opml><body /></opml>' })),
      importOpml: vi.fn(async () => ({ imported: 0, skipped: 0 })),
      exportBackup: vi.fn(async () => ({ filePath: 'backup.db' })),
      exportDiagnostics: vi.fn(async () => ({ filePath: 'diagnostics.json', entries: 0 })),
      openReaderTab: vi.fn(async () => ({ state: null })),
      activateReaderTab: vi.fn(async () => ({ state: null })),
      closeReaderTab: vi.fn(async () => ({ state: null })),
      closeReader: vi.fn(async () => ({ state: null })),
      repositionReader: vi.fn(async () => ({ state: null })),

    };
    (window as any).readit = api;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(<AppShell />));
    await flush();

    const search = document.querySelector('.search-field input') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(search, 'climate');
      search.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    await click('Search');
    expect(api.queryItems).toHaveBeenLastCalledWith(expect.objectContaining({ sectionId: -1, query: 'climate', includeSeen: true }));

    const dateSelect = document.querySelector('select[aria-label="Date"]') as HTMLSelectElement;
    const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await act(async () => {
      selectSetter?.call(dateSelect, 'custom');
      dateSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.querySelector('.date-trigger')).toBeNull();
    expect(document.querySelectorAll('.rdp-outside button')).toHaveLength(0);
    const calendarDay = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'))
      .find((button) => !button.disabled && !button.closest('.rdp-outside'));
    expect(calendarDay).toBeTruthy();
    await act(async () => calendarDay!.click());
    await flush();
    expect(consoleInfo).toHaveBeenCalledWith('search_custom_date_selected', expect.any(String));
    expect(dateSelect.selectedOptions[0].textContent).not.toBe('Custom date');
    expect(document.querySelector('[aria-label="Custom date calendar"]')).toBeNull();

    await click('Search');
    const exactDateQuery = vi.mocked(api.queryItems).mock.calls.at(-1)?.[0];
    expect(exactDateQuery).toEqual(expect.objectContaining({
      publishedAfter: expect.any(String),
      publishedBefore: expect.any(String),
    }));
    expect(new Date(exactDateQuery!.publishedBefore!).getTime())
      .toBeGreaterThan(new Date(exactDateQuery!.publishedAfter!).getTime());

    const expandSources = document.querySelector('[aria-label="Expand feed sources"]') as HTMLButtonElement;
    await act(async () => expandSources.click());
    await click('Mute');
    expect(api.updateFeed).toHaveBeenCalledWith({ feedId: 7, muted: true, enabled: true });

    await act(async () => progressListener?.({ scope: 'section', sectionId: 1, completed: 1, total: 2, percent: 50, feedId: 7 }));
    expect(document.querySelector('progress')?.getAttribute('value')).toBe('50');

    const sectionCalls = vi.mocked(api.listSections).mock.calls.length;
    const itemCalls = vi.mocked(api.queryItems).mock.calls.length;
    await act(async () => {
      completedListener?.({ source: 'scheduler', feedId: 7, sectionIds: [1], status: 'ok', newItems: 2 });
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(api.listSections).toHaveBeenCalledTimes(sectionCalls + 1);
    expect(vi.mocked(api.queryItems).mock.calls.length).toBe(itemCalls + 2);
    expect(api.queryItems).toHaveBeenLastCalledWith({ sectionId: 1, all: true });
  });

  it('opens article titles in the embedded reader dock and renders the tab strip', async () => {
    const article: ItemWire = {
      id: 21, feed_id: 7, link: 'https://example.com/story', title: 'Story headline', description: null,
      published_at: '2026-06-28T00:00:00.000Z', dedupe_key: 'story', created_at: '2026-06-28T00:00:00.000Z',
      feed_title: 'Example', is_read: 0, is_important: 0,
    };
    const readerState = {
      tabs: [{ tabId: 1, url: 'https://example.com/story', title: 'Story headline', sectionKey: 'science' }],
      activeTabId: 1,
      dockSectionKey: 'science',
      dockBounds: { x: 600, y: 0, width: 600, height: 800 },
    };
    const api: PreloadApi = {
      version: 2,
      listSections: vi.fn(async () => ({ sections: [{
        id: 1, key: 'science', name: 'Science', position_index: 0,
        feeds: [{
          id: 7, url: 'https://example.com/rss.xml', title: 'Example', site_url: null,
          last_fetched_at: null, last_error: null, fetch_interval_minutes: 30,
          is_enabled: 1 as const, is_muted: 0 as const, item_count: 1, unread_count: 1,
        }],
      }] })),
      createSection: vi.fn(async () => ({ changed: 0 })),
      updateSection: vi.fn(async () => ({ changed: 0 })),
      deleteSection: vi.fn(async () => ({ changed: 0 })),
      reorderSections: vi.fn(async () => ({ changed: 0 })),
      addFeedToSection: vi.fn(async () => ({ changed: 0 })),
      updateFeed: vi.fn(async () => ({ changed: 1 })),
      removeFeedFromSection: vi.fn(async () => ({ changed: 0 })),
      testFeed: vi.fn(async () => ({ status: 'ok' as const })),
      syncTrigger: vi.fn(async () => ({ status: 'ok' as const, scope: 'section' as const, requested: 0, triggered: 0, ok: 0, notModified: 0, errors: 0, newItems: 0, results: [] })),
      onSyncProgress: vi.fn(() => () => undefined),
      onSyncCompleted: vi.fn(() => () => undefined),
      onReaderState: vi.fn(() => () => undefined),
      queryItems: vi.fn(async () => ({ items: [article] })),
      markSectionSeen: vi.fn(async () => ({ changed: 0 })),
      markItemRead: vi.fn(async () => ({ changed: 1 })),
      toggleItemImportant: vi.fn(async () => ({ is_important: 1 as const })),
      getLayout: vi.fn(async () => ({ layout: { mode: 'stack' as const, panels: [], appearance: {} } })),
      setLayout: vi.fn(async ({ layout }) => ({ layout })),
      openExternal: vi.fn(async () => ({ opened: true })),
      openReaderTab: vi.fn(async () => ({ state: readerState })),
      activateReaderTab: vi.fn(async () => ({ state: readerState })),
      closeReaderTab: vi.fn(async () => ({ state: null })),
      closeReader: vi.fn(async () => ({ state: null })),
      repositionReader: vi.fn(async () => ({ state: readerState })),
      exportOpml: vi.fn(async () => ({ opml: '<opml><body /></opml>' })),
      importOpml: vi.fn(async () => ({ imported: 0, skipped: 0 })),
      exportBackup: vi.fn(async () => ({ filePath: 'backup.db' })),
      exportDiagnostics: vi.fn(async () => ({ filePath: 'diagnostics.json', entries: 0 })),
    };
    (window as any).readit = api;
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: 0, top: 0, left: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}),
    } as DOMRect));
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(<AppShell />));
    await flush();

    const title = document.querySelector('.item-title') as HTMLAnchorElement;
    await act(async () => title.click());
    await flush();

    expect(api.markItemRead).toHaveBeenCalledWith({ itemId: 21 });
    expect(api.openReaderTab).toHaveBeenCalledWith({
      sectionKey: 'science',
      url: 'https://example.com/story',
      title: 'Story headline',
      bounds: { x: 600, y: 0, width: 600, height: 800 },
    });
    expect(api.openExternal).not.toHaveBeenCalled();

    const strip = document.querySelector('.reader-strip') as HTMLElement;
    expect(strip).toBeTruthy();
    expect((strip.querySelector('.reader-tab-title') as HTMLElement).textContent).toBe('Story headline');
    expect(document.querySelector('.item-external')).toBeNull();

    const dockedShell = document.querySelector('.section-shell.reader-open') as HTMLElement;
    expect(dockedShell).toBeTruthy();
    expect(dockedShell.style.getPropertyValue('--reader-dock-width')).toBe('612px');
    expect(document.querySelector('.reader-divider')).toBeTruthy();

    const closeReaderButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.reader-strip-actions button'))
      .find((button) => button.textContent === 'Close reader');
    expect(closeReaderButton).toBeTruthy();
    await act(async () => closeReaderButton!.click());
    await flush();
    expect(api.closeReader).toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('supports optional keyboard navigation with a discoverable key map', async () => {
    window.localStorage.removeItem('readit:keyboardShortcuts');
    const article: ItemWire = {
      id: 21, feed_id: 7, link: 'https://example.com/story', title: 'Story headline', description: null,
      published_at: '2026-06-28T00:00:00.000Z', dedupe_key: 'story', created_at: '2026-06-28T00:00:00.000Z',
      feed_title: 'Example', is_read: 0, is_important: 0,
    };
    const readerState = {
      tabs: [{ tabId: 1, url: 'https://example.com/story', title: 'Story headline', sectionKey: 'science' }],
      activeTabId: 1,
      dockSectionKey: 'science',
      dockBounds: { x: 600, y: 0, width: 600, height: 800 },
    };
    const api: PreloadApi = {
      version: 2,
      listSections: vi.fn(async () => ({ sections: [{
        id: 1, key: 'science', name: 'Science', position_index: 0,
        feeds: [{
          id: 7, url: 'https://example.com/rss.xml', title: 'Example', site_url: null,
          last_fetched_at: null, last_error: null, fetch_interval_minutes: 30,
          is_enabled: 1 as const, is_muted: 0 as const, item_count: 1, unread_count: 1,
        }],
      }] })),
      createSection: vi.fn(async () => ({ changed: 0 })),
      updateSection: vi.fn(async () => ({ changed: 0 })),
      deleteSection: vi.fn(async () => ({ changed: 0 })),
      reorderSections: vi.fn(async () => ({ changed: 0 })),
      addFeedToSection: vi.fn(async () => ({ changed: 0 })),
      updateFeed: vi.fn(async () => ({ changed: 1 })),
      removeFeedFromSection: vi.fn(async () => ({ changed: 0 })),
      testFeed: vi.fn(async () => ({ status: 'ok' as const })),
      syncTrigger: vi.fn(async () => ({ status: 'ok' as const, scope: 'section' as const, requested: 0, triggered: 0, ok: 0, notModified: 0, errors: 0, newItems: 0, results: [] })),
      onSyncProgress: vi.fn(() => () => undefined),
      onSyncCompleted: vi.fn(() => () => undefined),
      onReaderState: vi.fn(() => () => undefined),
      queryItems: vi.fn(async () => ({ items: [article] })),
      markSectionSeen: vi.fn(async () => ({ changed: 0 })),
      markItemRead: vi.fn(async () => ({ changed: 1 })),
      toggleItemImportant: vi.fn(async () => ({ is_important: 1 as const })),
      getLayout: vi.fn(async () => ({ layout: { mode: 'stack' as const, panels: [], appearance: {} } })),
      setLayout: vi.fn(async ({ layout }) => ({ layout })),
      openExternal: vi.fn(async () => ({ opened: true })),
      openReaderTab: vi.fn(async () => ({ state: readerState })),
      activateReaderTab: vi.fn(async () => ({ state: readerState })),
      closeReaderTab: vi.fn(async () => ({ state: null })),
      closeReader: vi.fn(async () => ({ state: null })),
      repositionReader: vi.fn(async () => ({ state: readerState })),
      exportOpml: vi.fn(async () => ({ opml: '<opml><body /></opml>' })),
      importOpml: vi.fn(async () => ({ imported: 0, skipped: 0 })),
      exportBackup: vi.fn(async () => ({ filePath: 'backup.db' })),
      exportDiagnostics: vi.fn(async () => ({ filePath: 'diagnostics.json', entries: 0 })),
    };
    (window as any).readit = api;
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: 0, top: 0, left: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}),
    } as DOMRect));
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(<AppShell />));
    await flush();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });
    expect(document.querySelector('.item-card.keyboard-focus')).toBeNull();

    await act(async () => {
      (Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Manage') as HTMLButtonElement).click();
    });
    await act(async () => {
      (Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Enable keyboard shortcuts') as HTMLButtonElement).click();
    });
    expect(document.querySelector('.shortcut-map')).toBeTruthy();
    expect(window.localStorage.getItem('readit:keyboardShortcuts')).toBe('1');

    await act(async () => {
      (document.querySelector('.shortcut-map header button') as HTMLButtonElement).click();
    });
    expect(document.querySelector('.shortcut-map')).toBeNull();

    const firstCard = document.querySelector('.item-card') as HTMLElement;
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });
    expect(firstCard.classList.contains('keyboard-focus')).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();
    expect(api.markItemRead).toHaveBeenCalledWith({ itemId: 21 });
    expect(api.openReaderTab).toHaveBeenCalledTimes(1);

    await act(async () => {
      (Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Disable keyboard shortcuts') as HTMLButtonElement).click();
    });
    expect(window.localStorage.getItem('readit:keyboardShortcuts')).toBe('0');
    expect(document.querySelector('.shortcut-map')).toBeNull();
    rectSpy.mockRestore();
    window.localStorage.removeItem('readit:keyboardShortcuts');
  });
});
