// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/renderer/components/AppShell';
import type { PreloadApi, SyncCompletedWire, SyncProgressWire } from '../../app/shared/ipcTypes';

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
      version: 1,
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
      markItemsSeen: vi.fn(async () => ({ changed: 0 })),
      markSectionSeen: vi.fn(async () => ({ changed: 0 })),
      markItemRead: vi.fn(async () => ({ changed: 0 })),
      toggleItemImportant: vi.fn(async () => ({ is_important: 1 as const })),
      queryImportant: vi.fn(async () => ({ items: [] })),
      getLayout: vi.fn(async () => ({ layout: { mode: 'stack' as const, panels: [], appearance: {} } })),
      setLayout: vi.fn(async ({ layout }) => ({ layout })),
      openExternal: vi.fn(async () => ({ opened: true })),
      exportOpml: vi.fn(async () => ({ opml: '<opml><body /></opml>' })),
      importOpml: vi.fn(async () => ({ imported: 0, skipped: 0 })),
      exportBackup: vi.fn(async () => ({ filePath: 'backup.db' })),
      exportDiagnostics: vi.fn(async () => ({ filePath: 'diagnostics.json', entries: 0 })),
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
    expect(api.updateFeed).toHaveBeenCalledWith({ feedId: 7, muted: true });

    await act(async () => progressListener?.({ scope: 'section', sectionId: 1, completed: 1, total: 2, percent: 50, feedId: 7 }));
    expect(document.querySelector('progress')?.getAttribute('value')).toBe('50');

    const sectionCalls = vi.mocked(api.listSections).mock.calls.length;
    const itemCalls = vi.mocked(api.queryItems).mock.calls.length;
    await act(async () => {
      completedListener?.({ source: 'scheduler', feedId: 7, sectionIds: [1], status: 'ok', newItems: 2 });
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(api.listSections).toHaveBeenCalledTimes(sectionCalls + 1);
    expect(vi.mocked(api.queryItems).mock.calls.length).toBe(itemCalls + 1);
    expect(api.queryItems).toHaveBeenLastCalledWith({ sectionId: 1, all: true });
  });
});
