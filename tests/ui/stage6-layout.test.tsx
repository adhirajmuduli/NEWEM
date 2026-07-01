// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/renderer/components/AppShell';
import type { LayoutWire, PreloadApi, SectionWire } from '../../app/shared/ipcTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function section(id: number, key: string, name: string): SectionWire {
  return { id, key, name, position_index: id, feeds: [] };
}

function makeApi(initialLayout: LayoutWire) {
  let layout = initialLayout;
  const sections = [section(1, 'tech', 'Tech'), section(2, 'world', 'World')];
  const api: PreloadApi = {
    version: 1,
    listSections: vi.fn(async () => ({ sections })),
    createSection: vi.fn(async () => ({ changed: 0 })),
    updateSection: vi.fn(async () => ({ changed: 0 })),
    deleteSection: vi.fn(async () => ({ changed: 0 })),
    reorderSections: vi.fn(async ({ sectionIds }) => ({ changed: sectionIds.length })),
    addFeedToSection: vi.fn(async () => ({ changed: 0 })),
    updateFeed: vi.fn(async () => ({ changed: 0 })),
    removeFeedFromSection: vi.fn(async () => ({ changed: 0 })),
    testFeed: vi.fn(async () => ({ status: 'ok' as const })),
    syncTrigger: vi.fn(async () => ({ status: 'ok' as const, scope: 'all' as const, requested: 0, triggered: 0, ok: 0, notModified: 0, errors: 0, newItems: 0, results: [] })),
    queryItems: vi.fn(async () => ({ items: [] })),
    markItemsSeen: vi.fn(async () => ({ changed: 0 })),
    markSectionSeen: vi.fn(async () => ({ changed: 0 })),
    markItemRead: vi.fn(async () => ({ changed: 0 })),
    toggleItemImportant: vi.fn(async () => ({ is_important: 1 as const })),
    queryImportant: vi.fn(async () => ({ items: [] })),
    getLayout: vi.fn(async () => ({ layout })),
    setLayout: vi.fn(async ({ layout: next }) => {
      layout = next;
      return { layout };
    }),
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
    await Promise.resolve();
  });
}

async function renderApp(api: PreloadApi) {
  document.body.innerHTML = '<div id="root"></div>';
  (window as any).readit = api;
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(<AppShell />));
  await flush();
  return root;
}

async function click(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent === text) as HTMLButtonElement | undefined;
  expect(button).toBeTruthy();
  await act(async () => button!.click());
  await flush();
}
async function selectOption(label: string, value: string) {
  const select = document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement | null;
  expect(select).toBeTruthy();
  await act(async () => {
    select!.value = value;
    select!.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
}

async function selectSection(name: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.section-tile'))
    .find((node) => node.querySelector('strong')?.textContent === name);
  expect(button).toBeTruthy();
  await act(async () => button!.click());
  await flush();
}
describe('Stage 6 renderer layout controls', () => {
  let root: Root;
  let api: PreloadApi;

  beforeEach(async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    api = makeApi({ mode: 'columns', panels: [{ id: 'tech', x: 0, y: 0, w: 50, h: 1 }, { id: 'world', x: 1, y: 0, w: 50, h: 1 }], appearance: { tech: { mode: 'image', imageDataUrl: 'data:image/png;base64,AA==' } } });
    root = await renderApp(api);
  });

  afterEach(() => {
    root.unmount();
    vi.restoreAllMocks();
  });

  it('keeps section tools hidden until a translucent section tile is selected', async () => {
    await click('Manage');
    expect(document.querySelector('.manager-top-pane')).toBeTruthy();
    expect(document.querySelector('.manager-bottom-pane')).toBeNull();

    await selectSection('Tech');
    const selected = document.querySelector('.section-tile.selected') as HTMLButtonElement;
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.querySelector('strong')?.textContent).toBe('Tech');
    expect(document.querySelector('.manager-bottom-pane.open')).toBeTruthy();

    await click('Tech tools');
    expect(document.querySelector('.manager-bottom-pane.collapsed')).toBeTruthy();
  });
  it('updates panel width during resize and persists it on release', async () => {
    const handle = document.querySelector('[aria-label="Resize Tech"]') as HTMLElement;
    const techShell = document.querySelector('[data-panel-id="tech"]') as HTMLElement;
    expect(handle).toBeTruthy();

    const listCalls = (api.listSections as ReturnType<typeof vi.fn>).mock.calls.length;
    const queryCalls = (api.queryItems as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }));
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300 }));
    });
    expect(techShell.style.getPropertyValue('--panel-width')).toBe('70%');
    expect(api.setLayout).not.toHaveBeenCalled();
    expect((api.listSections as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(listCalls);
    expect((api.queryItems as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(queryCalls);
    expect(api.syncTrigger).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 300 }));
    });
    await flush();
    expect(api.setLayout).toHaveBeenCalledTimes(1);
    expect(api.setLayout).toHaveBeenCalledWith(expect.objectContaining({ layout: expect.objectContaining({ panels: expect.arrayContaining([expect.objectContaining({ id: 'tech', w: 70 })]) }) }));
  });

  it('hides panel controls and resets mode, dimensions, order, and section appearance', async () => {
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Move right')).toBe(false);
    const techSection = document.querySelector('[data-section-key="tech"]') as HTMLElement;
    expect(techSection.style.backgroundImage).toContain('data:image/png');

    await click('Manage');
    await selectSection('Tech');
    await click('Reset layout');

    expect(api.setLayout).toHaveBeenLastCalledWith(expect.objectContaining({
      layout: expect.objectContaining({
        mode: 'stack',
        appearance: {},
        panels: [
          expect.objectContaining({ id: 'tech', w: 100 }),
          expect.objectContaining({ id: 'world', w: 100 }),
        ],
      }),
    }));
    expect(techSection.style.backgroundImage).toBe('');
  });
  it('keeps the small viewport fallback usable without horizontal panel overflow', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 520 });
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'styles', 'app.css'), 'utf8');
    expect(css).toContain('@media (max-width: 860px)');
    expect(css).toContain('flex-basis: 100% !important');
    expect(css).toContain('.resize-handle { display: none; }');
  });

  it('exposes only the READIT theme without refreshing application data', async () => {
    await click('Manage');
    await selectSection('Tech');
    const listCalls = vi.mocked(api.listSections).mock.calls.length;
    const queryCalls = vi.mocked(api.queryItems).mock.calls.length;
    const themeSelect = document.querySelector('select[aria-label="App colour scheme"]') as HTMLSelectElement;

    expect([...themeSelect.options].map((option) => option.value)).toEqual(['readit']);
    await selectOption('App colour scheme', 'readit');

    expect(document.documentElement.dataset.colorScheme).toBe('readit');
    expect(document.documentElement.style.getPropertyValue('--manager-bg')).toBe('#111821');
    expect(api.setLayout).toHaveBeenCalledWith(expect.objectContaining({
      layout: expect.objectContaining({ theme: 'readit' }),
    }));
    expect(vi.mocked(api.listSections).mock.calls).toHaveLength(listCalls);
    expect(vi.mocked(api.queryItems).mock.calls).toHaveLength(queryCalls);
    expect(api.syncTrigger).not.toHaveBeenCalled();
  });

  it('implements mosaic as two columns with an odd full-width tail', async () => {
    await click('Manage');
    await selectSection('Tech');
    await click('mosaic');

    expect(document.querySelector('.layout-mosaic')).toBeTruthy();
    expect(api.setLayout).toHaveBeenCalledWith(expect.objectContaining({
      layout: expect.objectContaining({ mode: 'mosaic' }),
    }));
    const css = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'styles', 'app.css'), 'utf8');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('.layout-mosaic .section-shell:last-child:nth-child(odd)');
    expect([...document.querySelectorAll('.segmented button')].some((button) => button.textContent === 'columns')).toBe(false);
  });
  it('dismisses appearance validation errors after the fixed alert interval', async () => {
    await click('Manage');
    await selectSection('Tech');
    await click('solid');
    const input = document.querySelector('input[placeholder^="#151b24"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(input, 'invalid');
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });

    vi.useFakeTimers();
    try {
      await click('OK');
      expect(document.querySelector('.app-error')?.textContent).toContain('valid hex or rgb');
      await act(async () => vi.advanceTimersByTime(6000));
      expect(document.querySelector('.app-error')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it('persists a day window by stable section key without querying items', async () => {
    const queryCalls = vi.mocked(api.queryItems).mock.calls.length;
    await selectOption('Tech news window', '14');

    expect(api.setLayout).toHaveBeenCalledWith(expect.objectContaining({
      layout: expect.objectContaining({ dayWindows: { tech: 14 } }),
    }));
    expect(vi.mocked(api.queryItems).mock.calls).toHaveLength(queryCalls);
  });
});
