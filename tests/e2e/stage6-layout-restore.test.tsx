// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/renderer/components/AppShell';
import type { LayoutWire, PreloadApi, SectionWire } from '../../app/shared/ipcTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function section(id: number, key: string, name: string): SectionWire {
  return { id, key, name, position_index: id, feeds: [] };
}

function apiWithLayout(layoutRef: { current: LayoutWire }): PreloadApi {
  const sections = [section(1, 'tech', 'Tech'), section(2, 'world', 'World')];
  return {
    version: 1,
    listSections: vi.fn(async () => ({ sections })),
    createSection: vi.fn(async () => ({ changed: 0 })),
    updateSection: vi.fn(async () => ({ changed: 0 })),
    deleteSection: vi.fn(async () => ({ changed: 0 })),
    reorderSections: vi.fn(async ({ sectionIds }) => ({ changed: sectionIds.length })),
    addFeedToSection: vi.fn(async () => ({ changed: 0 })),
    updateFeed: vi.fn(async () => ({ changed: 0 })),
    removeFeedFromSection: vi.fn(async () => ({ changed: 0 })),
    testFeed: vi.fn(async () => ({ status: 'ok' })),
    syncTrigger: vi.fn(async () => ({ status: 'ok', scope: 'all', requested: 0, triggered: 0, ok: 0, notModified: 0, errors: 0, newItems: 0, results: [] })),
    queryItems: vi.fn(async () => ({ items: [] })),
    markItemsSeen: vi.fn(async () => ({ changed: 0 })),
    markSectionSeen: vi.fn(async () => ({ changed: 0 })),
    markItemRead: vi.fn(async () => ({ changed: 0 })),
    toggleItemImportant: vi.fn(async () => ({ is_important: 1 })),
    queryImportant: vi.fn(async () => ({ items: [] })),
    getLayout: vi.fn(async () => ({ layout: layoutRef.current })),
    setLayout: vi.fn(async ({ layout }) => {
      layoutRef.current = layout;
      return { layout };
    }),
    onSyncProgress: vi.fn(() => () => {}),
    exportOpml: vi.fn(async () => ({ opml: '<opml><body /></opml>' })),
    importOpml: vi.fn(async () => ({ imported: 0, skipped: 0 })),
    exportBackup: vi.fn(async () => ({ filePath: 'backup.db' })),
    exportDiagnostics: vi.fn(async () => ({ filePath: 'diagnostics.json', entries: 0 })),
    openExternal: vi.fn(async () => ({ opened: true })),
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(api: PreloadApi) {
  document.body.innerHTML = '<div id="root"></div>';
  (window as any).readit = api;
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(<AppShell />));
  await flush();
  return root;
}

afterEach(() => vi.restoreAllMocks());

describe('Stage 6 persisted layout restore', () => {
  it('restores resized panel order and width after remount', async () => {
    const layoutRef = { current: { mode: 'columns', theme: 'space', panels: [{ id: 'world', x: 0, y: 0, w: 64, h: 1 }, { id: 'tech', x: 1, y: 0, w: 42, h: 1 }], appearance: {} } as LayoutWire };
    let root: Root = await mount(apiWithLayout(layoutRef));

    expect((document.querySelector('[data-panel-id="world"]') as HTMLElement).style.order).toBe('0');
    expect((document.querySelector('[data-panel-id="world"]') as HTMLElement).style.getPropertyValue('--panel-width')).toBe('64%');
    expect(document.documentElement.dataset.colorScheme).toBe('space');
    root.unmount();

    root = await mount(apiWithLayout(layoutRef));
    expect((document.querySelector('[data-panel-id="world"]') as HTMLElement).style.order).toBe('0');
    expect((document.querySelector('[data-panel-id="world"]') as HTMLElement).style.getPropertyValue('--panel-width')).toBe('64%');
    expect(document.documentElement.dataset.colorScheme).toBe('space');
    root.unmount();
  });
});