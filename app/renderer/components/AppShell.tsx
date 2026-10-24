import React from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { applyColorScheme, COLOR_SCHEMES, DEFAULT_COLOR_SCHEME_ID, getColorScheme } from '../../shared/colorSchemes';
import type { ColorSchemeId } from '../../shared/colorSchemes';
import { READER_TAB_STRIP_HEIGHT } from '../../shared/ipcTypes';
import type { FeedWire, ItemWire, LayoutModeWire, LayoutWire, PreloadApi, ReaderBoundsWire, ReaderStateWire, SectionAppearanceWire, SectionWire, SyncCompletedWire, SyncProgressWire } from '../../shared/ipcTypes';
import { SectionPanel } from './SectionPanel';
import { AppearanceEditor } from './AppearanceEditor';
import { ItemList } from './ItemList';
import { Toolbar } from './Toolbar';
import { ResizeHandle } from '../layout/DragHandle';
import { clampPanelWidth, movePanel, normalizeLayoutForSections, orderedSectionsForLayout, panelWidth, resetLayoutForSections, resizePanel } from '../layout/GridLayout';
import { exactLocalDayRange, relativeDateRange, type SearchDateMode } from '../utils/dateRange';
import { HELP_TEXT } from '../helpText';

declare global {
  interface Window {
    readit: PreloadApi;
  }
}

type ItemState = Record<number, { loading: boolean; error: string | null; warning: string | null; items: ItemWire[]; hasOlder: boolean }>;
type FeedTestState = { url: string; resolvedUrl?: string; status: 'idle' | 'testing' | 'ok' | 'error'; message: string };

function api() {
  if (!window.readit) throw new Error('READIT preload API unavailable');
  return window.readit;
}

const ISO_LIKE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function itemSortTime(item: ItemWire) {
  return item.published_at && ISO_LIKE_TIMESTAMP.test(item.published_at) ? item.published_at : item.created_at;
}

const READER_SPLIT_MIN = 0.3;
const READER_SPLIT_MAX = 0.6;
const READER_SPLIT_STORAGE_KEY = 'readit:readerSplit';
const KEYBOARD_SHORTCUTS_STORAGE_KEY = 'readit:keyboardShortcuts';

function readStoredReaderSplit(): number {
  const stored = window.localStorage.getItem(READER_SPLIT_STORAGE_KEY);
  if (stored === null) return 0.5;
  const value = Number(stored);
  if (!Number.isFinite(value) || value <= 0) return 0.5;
  return Math.min(READER_SPLIT_MAX, Math.max(READER_SPLIT_MIN, value));
}

function readStoredKeyboardShortcuts(): boolean {
  return window.localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY) === '1';
}

function emptyItems(sections: SectionWire[]): ItemState {
  return Object.fromEntries(sections.map((section) => [section.id, { loading: false, error: null, warning: null, items: [], hasOlder: false }]));
}

function refreshWarning(triggered: number, errors: number) {
  if (errors === 0) return null;
  const successful = Math.max(0, triggered - errors);
  if (successful === 0) return `Refresh failed for all ${errors} source(s). Existing articles remain available; open feed status for details.`;
  return `Refresh completed for ${successful} source(s); ${errors} failed. Successful sources and existing articles remain available.`;
}

function styleForLayout(mode: LayoutModeWire | undefined) {
  return `sections layout-${mode || 'stack'}`;
}

function selectedAppearance(layout: LayoutWire, section?: SectionWire): SectionAppearanceWire {
  if (!section) return { mode: 'solid', solid: '#151b24' };
  return layout.appearance?.[section.key] || { mode: 'solid', solid: '#151b24' };
}

export function AppShell() {
  const [sections, setSections] = React.useState<SectionWire[]>([]);
  const [items, setItems] = React.useState<ItemState>({});
  const [layout, setLayoutState] = React.useState<LayoutWire>({ mode: 'stack', theme: DEFAULT_COLOR_SCHEME_ID, panels: [], appearance: {}, dayWindows: {} });
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [managerDetailsOpen, setManagerDetailsOpen] = React.useState(false);
  const [selectedSectionId, setSelectedSectionId] = React.useState<number | null>(null);
  const [newSectionName, setNewSectionName] = React.useState('');
  const [renameValue, setRenameValue] = React.useState('');
  const [feedUrl, setFeedUrl] = React.useState('');
  const [feedInterval, setFeedInterval] = React.useState('');
  const [feedTest, setFeedTest] = React.useState<FeedTestState>({ url: '', status: 'idle', message: '' });
  const [globalBusy, setGlobalBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [transientError, setTransientError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [readerState, setReaderState] = React.useState<ReaderStateWire | null>(null);
  const [keyboardShortcuts, setKeyboardShortcuts] = React.useState(readStoredKeyboardShortcuts);
  const [shortcutMapOpen, setShortcutMapOpen] = React.useState(false);
  const readerSplitRef = React.useRef(readStoredReaderSplit());
  const keyboardFocusRef = React.useRef(-1);
  const keyboardFocusedCardRef = React.useRef<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchUnread, setSearchUnread] = React.useState(false);
  const [searchImportant, setSearchImportant] = React.useState(false);
  const [searchFeedId, setSearchFeedId] = React.useState('');
  const [searchDays, setSearchDays] = React.useState<SearchDateMode>('');
  const [searchCustomDate, setSearchCustomDate] = React.useState<Date | undefined>();
  const [searchResults, setSearchResults] = React.useState<ItemWire[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchVisible, setSearchVisible] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<Record<number, number>>({});
  const [globalProgress, setGlobalProgress] = React.useState<number | undefined>();
  const [dataMessage, setDataMessage] = React.useState('');
  const panelElements = React.useRef(new Map<string, HTMLDivElement>());
  const selectedSectionIdRef = React.useRef<number | null>(null);
  const loadSeq = React.useRef(new Map<number, number>());

  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const orderedSections = React.useMemo(() => orderedSectionsForLayout(sections, layout), [sections, layout]);
  const appearance = selectedAppearance(layout, selectedSection);
  const colorScheme = getColorScheme(layout.theme);
  const searchFeeds = React.useMemo(
    () => sections.flatMap((section) => section.feeds)
      .filter((feed, index, all) => all.findIndex((row) => row.id === feed.id) === index),
    [sections]
  );

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      setTransientError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshSections(nextSelectedId?: number) {
    const response = await api().listSections();
    setSections(response.sections);
    setLayoutState((current) => normalizeLayoutForSections(current, response.sections));
    setItems((current) => {
      const next: ItemState = {};
      for (const section of response.sections) {
        next[section.id] = current[section.id] ?? { loading: false, error: null, warning: null, items: [], hasOlder: false };
      }
      return next;
    });
    const currentSelectedId = selectedSectionIdRef.current;
    const target = nextSelectedId && response.sections.some((section) => section.id === nextSelectedId)
      ? nextSelectedId
      : currentSelectedId && response.sections.some((section) => section.id === currentSelectedId)
        ? currentSelectedId
        : null;
    setSelectedSectionId(target);
    setRenameValue(target ? response.sections.find((section) => section.id === target)?.name || '' : '');
    if (target === null) setManagerDetailsOpen(false);
    return response.sections;
  }

  async function loadItems(sectionId: number) {
    const seq = (loadSeq.current.get(sectionId) ?? 0) + 1;
    loadSeq.current.set(sectionId, seq);
    setItems((current) => ({ ...current, [sectionId]: { ...(current[sectionId] || { items: [], warning: null, hasOlder: false }), loading: true, error: null } }));
    try {
      const response = await api().queryItems({ sectionId, all: true });
      if (loadSeq.current.get(sectionId) !== seq) return;
      setItems((current) => ({ ...current, [sectionId]: { loading: false, error: null, warning: current[sectionId]?.warning || null, items: response.items, hasOlder: response.truncated ?? false } }));
    } catch (err) {
      if (loadSeq.current.get(sectionId) !== seq) return;
      setItems((current) => ({
        ...current,
        [sectionId]: { ...(current[sectionId] || { items: [], warning: null, hasOlder: false }), loading: false, error: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  async function loadOlder(sectionId: number) {
    const currentItems = items[sectionId]?.items ?? [];
    if (currentItems.length === 0) return;
    let oldest = currentItems[0];
    for (const candidate of currentItems) {
      if (itemSortTime(candidate) < itemSortTime(oldest)) oldest = candidate;
    }
    const before = itemSortTime(oldest);
    const seq = (loadSeq.current.get(sectionId) ?? 0) + 1;
    loadSeq.current.set(sectionId, seq);
    setItems((current) => ({ ...current, [sectionId]: { ...current[sectionId], loading: true, error: null } }));
    try {
      const response = await api().queryItems({ sectionId, all: true, before });
      if (loadSeq.current.get(sectionId) !== seq) return;
      setItems((current) => {
        const existing = current[sectionId]?.items ?? [];
        const existingIds = new Set(existing.map((item) => item.id));
        const appended = response.items.filter((item) => !existingIds.has(item.id));
        return {
          ...current,
          [sectionId]: { ...current[sectionId], loading: false, error: null, items: [...existing, ...appended], hasOlder: response.truncated ?? false },
        };
      });
    } catch (err) {
      if (loadSeq.current.get(sectionId) !== seq) return;
      setItems((current) => ({
        ...current,
        [sectionId]: { ...current[sectionId], loading: false, error: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

  async function loadAllItems(nextSections = sections) {
    await Promise.all(nextSections.map((section) => loadItems(section.id)));
  }

  async function initialLoad() {
    try {
      setError(null);
      const [sectionsResponse, layoutResponse] = await Promise.all([api().listSections(), api().getLayout()]);
      const normalized = normalizeLayoutForSections(layoutResponse.layout, sectionsResponse.sections);
      setSections(sectionsResponse.sections);
      setItems(emptyItems(sectionsResponse.sections));
      setLayoutState(normalized);

      await Promise.all(sectionsResponse.sections.map((section) => loadItems(section.id)));
      console.info('app_shell_ready sections=' + sectionsResponse.sections.length);
    } catch (err) {
      console.error('app_shell_initial_load_failed', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  React.useLayoutEffect(() => {
    applyColorScheme(document.documentElement, layout.theme);
  }, [layout.theme]);

  React.useEffect(() => {
    void initialLoad();
  }, []);
  React.useEffect(() => {
    if (!transientError) return;
    const timer = window.setTimeout(() => setTransientError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [transientError]);

  React.useEffect(() => {
    selectedSectionIdRef.current = selectedSection?.id ?? null;
    if (selectedSection) setRenameValue(selectedSection.name);
  }, [selectedSection?.id]);

  React.useEffect(() => {
    if (!window.readit) {
      setError('READIT preload API unavailable. Restart the application or rebuild the preload bundle.');
      return;
    }
    const pendingProgressReloads = new Map<number, number>();
    const unsubscribe = window.readit.onSyncProgress?.((progress: SyncProgressWire) => {
      if (progress.sectionId) {
        setSyncProgress((current) => ({ ...current, [progress.sectionId as number]: progress.percent }));
        const sectionId = progress.sectionId as number;
        const existing = pendingProgressReloads.get(sectionId);
        if (existing !== undefined) window.clearTimeout(existing);
        pendingProgressReloads.set(sectionId, window.setTimeout(() => {
          pendingProgressReloads.delete(sectionId);
          void loadItems(sectionId);
        }, 750));
      } else {
        setGlobalProgress(progress.percent);
      }
      if (progress.percent >= 100) {
        window.setTimeout(() => {
          if (progress.sectionId) {
            setSyncProgress((current) => {
              const next = { ...current };
              delete next[progress.sectionId as number];
              return next;
            });
          } else {
            setGlobalProgress(undefined);
          }
        }, 800);
      }
    });
    return () => {
      unsubscribe?.();
      for (const timer of pendingProgressReloads.values()) window.clearTimeout(timer);
    };
  }, []);

  React.useEffect(() => {
    const pendingSectionIds = new Set<number>();
    let reloadTimer: number | undefined;
    const unsubscribe = window.readit?.onSyncCompleted?.((event: SyncCompletedWire) => {
      event.sectionIds.forEach((sectionId) => pendingSectionIds.add(sectionId));
      if (reloadTimer !== undefined) return;
      reloadTimer = window.setTimeout(() => {
        reloadTimer = undefined;
        const sectionIds = [...pendingSectionIds];
        pendingSectionIds.clear();
        void refreshSections(selectedSectionIdRef.current ?? undefined)
          .then((nextSections) => Promise.all(sectionIds
            .filter((sectionId) => nextSections.some((section) => section.id === sectionId))
            .map((sectionId) => loadItems(sectionId))))
          .catch((err) => setError(`Automatic refresh update failed: ${err instanceof Error ? err.message : String(err)}`));
      }, 750);
    });
    return () => {
      unsubscribe?.();
      if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
    };
  }, []);

  React.useEffect(() => {
    const unsubscribe = window.readit?.onReaderState?.((state) => setReaderState(state));
    return () => {
      unsubscribe?.();
    };
  }, []);

  React.useEffect(() => {
    const dockSectionKey = readerState?.dockSectionKey;
    if (!dockSectionKey) return;
    let frame = 0;
    let scheduled = false;
    const reposition = () => {
      if (scheduled) return;
      scheduled = true;
      frame = window.requestAnimationFrame(() => {
        scheduled = false;
        const bounds = sectionReaderBounds(dockSectionKey);
        if (bounds && window.readit) {
          void window.readit.repositionReader({ sectionKey: dockSectionKey, bounds }).catch(() => undefined);
        }
      });
    };
    const sectionsElement = document.querySelector('.sections');
    sectionsElement?.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    const dockedElement = panelElements.current.get(dockSectionKey);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reposition);
    dockedElement ? observer?.observe(dockedElement) : reposition();
    reposition();
    return () => {
      sectionsElement?.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [readerState?.dockSectionKey]);

  function applyKeyboardFocus(index: number): number {
    const cards = document.querySelectorAll<HTMLElement>('.sections .item-card');
    if (cards.length === 0) return -1;
    const clamped = Math.max(0, Math.min(cards.length - 1, index));
    if (keyboardFocusedCardRef.current) keyboardFocusedCardRef.current.classList.remove('keyboard-focus');
    const target = cards[clamped];
    target.classList.add('keyboard-focus');
    if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
    keyboardFocusedCardRef.current = target;
    return clamped;
  }

  function clearKeyboardFocus() {
    if (keyboardFocusedCardRef.current) keyboardFocusedCardRef.current.classList.remove('keyboard-focus');
    keyboardFocusedCardRef.current = null;
    keyboardFocusRef.current = -1;
  }

  function clickFocusedCard(selector: string) {
    const target = keyboardFocusedCardRef.current?.querySelector(selector) as HTMLElement | null;
    target?.click();
  }

  function markFocusedCardRead() {
    const card = keyboardFocusedCardRef.current;
    if (!card) return;
    const itemId = Number(card.dataset.itemId);
    const sectionId = Number(card.dataset.sectionId);
    const item = sectionId > 0
      ? items[sectionId]?.items.find((row) => row.id === itemId)
      : searchResults.find((row) => row.id === itemId);
    if (!item) return;
    void run(async () => {
      await api().markItemRead({ itemId: item.id });
      if (sectionId > 0) {
        setItems((current) => ({
          ...current,
          [sectionId]: {
            ...(current[sectionId] || { loading: false, error: null, warning: null, items: [], hasOlder: false }),
            items: (current[sectionId]?.items || []).map((row) => row.id === item.id ? { ...row, is_read: 1 as const } : row),
          },
        }));
      } else {
        setSearchResults((current) => current.map((row) => row.id === item.id ? { ...row, is_read: 1 as const } : row));
      }
    });
  }

  function toggleKeyboardShortcuts() {
    const next = !keyboardShortcuts;
    setKeyboardShortcuts(next);
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, next ? '1' : '0');
    setShortcutMapOpen(next);
    if (!next) clearKeyboardFocus();
  }

  React.useEffect(() => {
    if (!keyboardShortcuts) {
      clearKeyboardFocus();
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const editable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (event.key === 'Escape') {
        if (readerState && readerState.tabs.length > 0) void run(() => closeReader());
        else if (searchVisible) setSearchVisible(false);
        else clearKeyboardFocus();
        return;
      }
      if (editable) return;
      if (event.key === 'j' || event.key === 'J' || event.key === 'ArrowDown') {
        event.preventDefault();
        keyboardFocusRef.current = applyKeyboardFocus(keyboardFocusRef.current + 1);
      } else if (event.key === 'k' || event.key === 'K' || event.key === 'ArrowUp') {
        event.preventDefault();
        keyboardFocusRef.current = applyKeyboardFocus(keyboardFocusRef.current <= 0 ? 0 : keyboardFocusRef.current - 1);
      } else if (event.key === 'o' || event.key === 'Enter') {
        if (keyboardFocusRef.current >= 0) {
          event.preventDefault();
          clickFocusedCard('.item-title');
        }
      } else if (event.key === 'i' || event.key === 'I') {
        if (keyboardFocusRef.current >= 0) {
          event.preventDefault();
          clickFocusedCard('.important-toggle');
        }
      } else if (event.key === 'r' || event.key === 'R') {
        if (keyboardFocusRef.current >= 0) {
          event.preventDefault();
          markFocusedCardRead();
        }
      } else if (event.key === '/') {
        event.preventDefault();
        (document.querySelector('.search-field input') as HTMLInputElement | null)?.focus();
      } else if (/^[1-9]$/.test(event.key)) {
        const section = orderedSections[Number(event.key) - 1];
        if (section) panelElements.current.get(section.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [keyboardShortcuts, readerState, searchVisible, orderedSections, items, searchResults]);

  async function persistLayout(next: LayoutWire) {
    const normalized = normalizeLayoutForSections(next, sections);
    setLayoutState(normalized);
    try {
      const response = await api().setLayout({ layout: normalized });
      setLayoutState(normalizeLayoutForSections(response.layout, sections));
    } catch (err) {
      try {
        const response = await api().getLayout();
        setLayoutState(normalizeLayoutForSections(response.layout, sections));
      } catch {
        // Keep the optimistic layout if resynchronization also fails.
      }
      throw err;
    }
  }

  async function createSection() {
    const name = newSectionName.trim();
    if (!name) return;
    const response = await api().createSection({ name });
    setNewSectionName('');
    await refreshSections(response.section?.id);
    if (response.section?.id) {
      setManagerDetailsOpen(true);
      await loadItems(response.section.id);
    }
  }

  async function renameSection() {
    if (!selectedSection || !renameValue.trim()) return;
    await api().updateSection({ sectionId: selectedSection.id, name: renameValue.trim() });
    await refreshSections(selectedSection.id);
  }

  async function deleteSection() {
    if (!selectedSection) return;
    if (selectedSection.feeds.length > 0 && !confirm(`Delete ${selectedSection.name} and remove ${selectedSection.feeds.length} feed mapping(s)?`)) return;
    await api().deleteSection({ sectionId: selectedSection.id });
    await refreshSections();
  }

  async function moveSection(direction: -1 | 1) {
    if (!selectedSection) return;
    const reordered = movePanel(layout, selectedSection.key, direction);
    if (reordered === layout) return;
    const idByKey = new Map(sections.map((section) => [section.key, section.id] as const));
    const orderedIds = reordered.panels
      .map((panel) => idByKey.get(panel.id))
      .filter((id): id is number => id !== undefined);
    const orderById = new Map(orderedIds.map((id, index) => [id, index] as const));
    setSections((current) => [...current]
      .sort((a, b) => (orderById.get(a.id) ?? 9999) - (orderById.get(b.id) ?? 9999))
      .map((section, position_index) => ({ ...section, position_index })));
    await run(async () => {
      await api().reorderSections({ sectionIds: orderedIds });
      await persistLayout(reordered);
    });
    await refreshSections(selectedSection.id);
  }

  async function testFeed() {
    const url = feedUrl.trim();
    if (!url) return;
    setFeedTest({ url, status: 'testing', message: 'Testing feed...' });
    try {
      const response = await api().testFeed({ url });
      if (response.status === 'ok') {
        const resolvedUrl = response.feedUrl || url;
        const discovery = response.discovered ? ` Discovered: ${resolvedUrl}` : '';
        setFeedTest({
          url,
          resolvedUrl,
          status: 'ok',
          message: (response.title ? `Valid feed: ${response.title}.` : 'Valid RSS/Atom feed.') + discovery,
        });
      } else {
        setFeedTest({ url, status: 'error', message: response.error?.message || 'Feed validation failed' });
      }
    } catch (error) {
      setFeedTest({ url, status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function addFeed() {
    if (!selectedSection || feedTest.status !== 'ok' || feedTest.url !== feedUrl.trim()) return;
    const sectionId = selectedSection.id;
    const sectionName = selectedSection.name;
    const intervalText = feedInterval.trim();
    const interval = intervalText ? Number(intervalText) : undefined;
    if (interval !== undefined && (!Number.isInteger(interval) || interval < 1 || interval > 1440)) {
      setFeedTest({ ...feedTest, status: 'error', message: 'Feed interval must be a whole number from 1 to 1440 minutes.' });
      return;
    }
    try {
      const response = await api().addFeedToSection({
        sectionId,
        url: feedTest.resolvedUrl || feedUrl.trim(),
        ...(interval === undefined ? {} : { fetchIntervalMinutes: interval }),
        enabled: true,
      });
      setFeedUrl('');
      setFeedInterval('');
      setFeedTest({
        url: '',
        status: 'idle',
        message: response.changed === 1
          ? `Feed added to ${sectionName}.`
          : `Feed already belongs to ${sectionName}; its settings were updated.`,
      });
      await refreshSections(sectionId);
    } catch (error) {
      setFeedTest({ ...feedTest, status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function exitApplication() {
    try {
      const closeApplication = api().closeApplication;
      if (closeApplication) await closeApplication();
      else window.close();
    } catch (error) {
      setTransientError(`Could not exit READIT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function removeFeed(feed: FeedWire) {
    if (!selectedSection) return;
    await api().removeFeedFromSection({ sectionId: selectedSection.id, feedId: feed.id });
    await refreshSections(selectedSection.id);
    await loadItems(selectedSection.id);
  }

  async function refreshSection(sectionId: number) {
    setItems((current) => ({
      ...current,
      [sectionId]: { ...(current[sectionId] || { items: [], hasOlder: false }), loading: true, error: null, warning: null },
    }));
    try {
      const response = await api().syncTrigger({ sectionId });
      await refreshSections(sectionId);
      await loadItems(sectionId);
      setItems((current) => ({
        ...current,
        [sectionId]: {
          ...(current[sectionId] || { items: [], hasOlder: false }),
          loading: false,
          error: null,
          warning: refreshWarning(response.triggered, response.errors),
        },
      }));
    } catch (err) {
      setItems((current) => ({
        ...current,
        [sectionId]: {
          ...(current[sectionId] || { items: [], hasOlder: false }),
          loading: false,
          error: `Refresh could not complete: ${err instanceof Error ? err.message : String(err)}`,
          warning: null,
        },
      }));
    }
  }

  async function refreshAll() {
    setGlobalBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api().syncTrigger({});
      const nextSections = await refreshSections(selectedSection?.id);
      await loadAllItems(nextSections);
      setNotice(refreshWarning(response.triggered, response.errors));
    } catch (err) {
      setError(`Refresh could not complete: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGlobalBusy(false);
    }
  }
  async function markSectionSeen(sectionId: number) {
    await api().markSectionSeen({ sectionId });
    await loadItems(sectionId);
    await refreshSections(sectionId);
  }

  function sectionReaderBounds(sectionKey: string): ReaderBoundsWire | null {
    const element = panelElements.current.get(sectionKey);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width < 200 || rect.height < 200) return null;
    const dockWidth = Math.max(120, Math.round(rect.width * readerSplitRef.current));
    return {
      x: Math.round(rect.right) - dockWidth,
      y: Math.round(rect.top),
      width: dockWidth,
      height: Math.round(rect.height),
    };
  }

  function repositionReader(sectionKey: string) {
    const bounds = sectionReaderBounds(sectionKey);
    if (!bounds) return Promise.resolve(undefined);
    return window.readit.repositionReader({ sectionKey, bounds })
      .then((response) => {
        setReaderState(response.state);
      })
      .catch(() => undefined);
  }

  function startReaderResize(_startClientX: number) {
    const dockSectionKey = readerState?.dockSectionKey;
    if (!dockSectionKey) return;
    const shell = panelElements.current.get(dockSectionKey);
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      const clientX = event.clientX;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const fraction = (rect.right - clientX) / rect.width;
        readerSplitRef.current = Math.min(READER_SPLIT_MAX, Math.max(READER_SPLIT_MIN, fraction));
        void repositionReader(dockSectionKey);
      });
    };
    const cleanup = () => {
      document.body.removeEventListener('pointermove', onMove);
      document.body.removeEventListener('pointerup', onUp);
      document.body.removeEventListener('pointercancel', onCancel);
    };
    const onUp = () => {
      cleanup();
      window.localStorage.setItem(READER_SPLIT_STORAGE_KEY, String(readerSplitRef.current));
    };
    const onCancel = () => {
      cleanup();
    };
    document.body.addEventListener('pointermove', onMove);
    document.body.addEventListener('pointerup', onUp, { once: true });
    document.body.addEventListener('pointercancel', onCancel, { once: true });
  }

  async function openItem(sectionId: number, item: ItemWire) {
    if (!item.link) return;
    await api().markItemRead({ itemId: item.id });
    const section = sectionId > 0 ? sections.find((candidate) => candidate.id === sectionId) : undefined;
    const bounds = section ? sectionReaderBounds(section.key) : null;
    if (section && bounds) {
      const response = await api().openReaderTab({
        sectionKey: section.key,
        url: item.link,
        title: item.title || 'Untitled article',
        bounds,
      });
      setReaderState(response.state);
    } else {
      await api().openExternal({ url: item.link });
    }
    if (sectionId > 0) await loadItems(sectionId);
    else await runSearch();
  }

  async function openUrlExternally(url: string) {
    await api().openExternal({ url });
  }

  async function activateReaderTab(tabId: number) {
    const response = await api().activateReaderTab({ tabId });
    setReaderState(response.state);
  }

  async function closeReaderTab(tabId: number) {
    const response = await api().closeReaderTab({ tabId });
    setReaderState(response.state);
  }

  async function closeReader() {
    const response = await api().closeReader();
    setReaderState(response.state);
  }

  async function toggleImportant(sectionId: number, item: ItemWire) {
    const response = await api().toggleItemImportant({ itemId: item.id });
    if (sectionId < 0) {
      setSearchResults((current) => current.map((row) => row.id === item.id ? { ...row, is_important: response.is_important } : row));
      return;
    }
    setItems((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] || { loading: false, error: null, warning: null, items: [], hasOlder: false }),
        items: (current[sectionId]?.items || []).map((row) => row.id === item.id ? { ...row, is_important: response.is_important } : row),
      },
    }));
  }

  async function runSearch() {
    if (searchDays === 'custom' && !searchCustomDate) {
      setError('Select an exact date before running a custom-date search.');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const dateRange = searchDays === 'custom' && searchCustomDate
        ? exactLocalDayRange(searchCustomDate)
        : relativeDateRange(searchDays);
      const response = await api().queryItems({
        sectionId: -1,
        all: true,
        includeSeen: true,
        query: searchQuery.trim() || undefined,
        feedId: searchFeedId ? Number(searchFeedId) : undefined,
        unreadOnly: searchUnread || undefined,
        importantOnly: searchImportant || undefined,
        ...dateRange,
      });
      setSearchResults(response.items);
      setSearchVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchUnread(false);
    setSearchImportant(false);
    setSearchFeedId('');
    setSearchDays('');
    setSearchCustomDate(undefined);
    setSearchResults([]);
    setSearchVisible(false);
  }

  function selectCustomSearchDate(date?: Date) {
    setSearchCustomDate(date);
    if (date) console.info('search_custom_date_selected', date.toISOString());
  }

  async function toggleMute(feed: FeedWire, next: boolean) {
    await api().updateFeed({ feedId: feed.id, muted: next, enabled: true });
    await refreshSections(selectedSection?.id);
  }

  async function updateInterval(feed: FeedWire, minutes: number | null) {
    await api().updateFeed({ feedId: feed.id, fetchIntervalMinutes: minutes });
    await refreshSections(selectedSection?.id);
  }

  function downloadText(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportSubscriptions() {
    const response = await api().exportOpml();
    downloadText('readit-subscriptions.opml', response.opml, 'text/x-opml');
    setDataMessage('OPML export created.');
  }

  async function importSubscriptions(file: File) {
    if (file.size > 5_000_000) throw new Error('OPML file must be 5 MB or smaller');
    const response = await api().importOpml({ opml: await file.text() });
    setDataMessage(`Imported ${response.imported} feed mapping(s); skipped ${response.skipped}.`);
    await refreshSections(selectedSection?.id);
  }

  async function exportBackup() {
    const response = await api().exportBackup();
    setDataMessage(`Database backup created at ${response.filePath}`);
  }

  async function exportDiagnosticBundle() {
    const response = await api().exportDiagnostics();
    setDataMessage(`Diagnostics exported to ${response.filePath}`);
  }
  async function updateColorScheme(theme: ColorSchemeId) {
    const previousTheme = layout.theme;
    applyColorScheme(document.documentElement, theme);
    try {
      await persistLayout({ ...layout, theme });
    } catch (err) {
      applyColorScheme(document.documentElement, previousTheme);
      throw err;
    }
  }

  async function updateAppearanceForSection(sectionKey: string, next: SectionAppearanceWire) {
    if (!sections.some((section) => section.key === sectionKey)) throw new Error('Section no longer exists');
    await persistLayout({
      ...layout,
      appearance: { ...(layout.appearance || {}), [sectionKey]: next },
    });
  }

  async function updateSectionDayWindow(sectionKey: string, days: number | null) {
    await persistLayout({
      ...layout,
      dayWindows: { ...(layout.dayWindows || {}), [sectionKey]: days },
    });
  }
  async function resetLayout() {
    await persistLayout(resetLayoutForSections(sections, colorScheme.id));
  }

  function startResize(sectionKey: string, startClientX: number) {
    const startWidth = panelWidth(layout, sectionKey);
    const viewportWidth = Math.max(360, window.innerWidth || 1200);
    const panel = panelElements.current.get(sectionKey);
    let previewWidth = startWidth;
    const onMove = (event: PointerEvent) => {
      const deltaPct = ((event.clientX - startClientX) / viewportWidth) * 100;
      previewWidth = clampPanelWidth(startWidth + deltaPct);
      panel?.style.setProperty('--panel-width', String(previewWidth) + '%');
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    const onUp = async () => {
      cleanup();
      try {
        await persistLayout(resizePanel(layout, sectionKey, previewWidth));
      } catch (err) {
        panel?.style.setProperty('--panel-width', String(startWidth) + '%');
        setTransientError(err instanceof Error ? err.message : String(err));
      }
    };
    const onCancel = () => {
      cleanup();
      panel?.style.setProperty('--panel-width', String(startWidth) + '%');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onCancel, { once: true });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Skip to sections</a>
      <Toolbar
        busy={globalBusy}
        search={{
          query: searchQuery,
          unread: searchUnread,
          important: searchImportant,
          feedId: searchFeedId,
          dateMode: searchDays,
          customDate: searchCustomDate,
          feeds: searchFeeds,
          searching,
          onQueryChange: setSearchQuery,
          onUnreadChange: setSearchUnread,
          onImportantChange: setSearchImportant,
          onFeedChange: setSearchFeedId,
          onDateModeChange: setSearchDays,
          onCustomDateChange: selectCustomSearchDate,
          onSearch: () => void runSearch(),
          onClear: clearSearch,
        }}
        onRefreshAll={() => void refreshAll()}
        onOpenManager={() => setManagerOpen((open) => !open)}
        onExitApplication={() => void exitApplication()}
      />
      {transientError ? <div className="app-error transient" role="alert">{transientError}</div> : null}
      {error ? <div className="app-error" role="alert">{error}</div> : null}
      {notice ? <div className="app-notice" role="status">{notice}</div> : null}
      {searchVisible ? <section className="search-results" aria-label="Search results"><header><h2>Local results</h2><span>{searchResults.length} item(s)</span><button type="button" onClick={() => setSearchVisible(false)}>Close</button></header><div className="search-results-scroll"><ItemList sectionId={-1} items={searchResults} openItem={(sectionId, item) => void run(() => openItem(sectionId, item))} onToggleImportant={(sectionId, item) => void run(() => toggleImportant(sectionId, item))} /></div></section> : null}

      {readerState && readerState.tabs.length > 0 && readerState.dockBounds ? (
        <>
          <div
            className="reader-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize article reader"
            title="Drag to resize the article reader"
            style={{
              left: readerState.dockBounds.x - 4,
              top: readerState.dockBounds.y,
              height: readerState.dockBounds.height,
            } as React.CSSProperties}
            onPointerDown={(event) => {
              event.preventDefault();
              startReaderResize(event.clientX);
            }}
          />
          <div
            className="reader-strip"
            role="tablist"
            aria-label="Article reader tabs"
            style={{
              left: readerState.dockBounds.x,
              top: readerState.dockBounds.y,
              width: readerState.dockBounds.width,
              height: READER_TAB_STRIP_HEIGHT,
            } as React.CSSProperties}
          >
          <div className="reader-tabs">
            {readerState.tabs.map((tab) => (
              <div key={tab.tabId} className={tab.tabId === readerState.activeTabId ? 'reader-tab selected' : 'reader-tab'}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab.tabId === readerState.activeTabId}
                  className="reader-tab-main"
                  onClick={() => void run(() => activateReaderTab(tab.tabId))}
                  title={tab.title}
                >
                  <span className="reader-tab-title">{tab.title}</span>
                </button>
                <button
                  type="button"
                  className="reader-tab-close"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => void run(() => closeReaderTab(tab.tabId))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="reader-strip-actions">
            <button
              type="button"
              title="Open the active tab in your system browser"
              onClick={() => {
                const active = readerState.tabs.find((tab) => tab.tabId === readerState.activeTabId);
                if (active) void run(() => openUrlExternally(active.url));
              }}
            >
              Open in browser
            </button>
            <button type="button" title="Close the article reader" onClick={() => void run(() => closeReader())}>
              Close reader
            </button>
          </div>
          </div>
        </>
      ) : null}

      {keyboardShortcuts && shortcutMapOpen ? (
        <div className="shortcut-map" role="dialog" aria-label="Keyboard shortcut reference">
          <header>
            <strong>Keyboard shortcuts</strong>
            <button type="button" aria-label="Close shortcut reference" onClick={() => setShortcutMapOpen(false)}>✕</button>
          </header>
          <table>
            <thead><tr><th>Key</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td>j / ArrowDown</td><td>Next article</td></tr>
              <tr><td>k / ArrowUp</td><td>Previous article</td></tr>
              <tr><td>o / Enter</td><td>Open the focused article in the reader</td></tr>
              <tr><td>i</td><td>Toggle important on the focused article</td></tr>
              <tr><td>r</td><td>Mark the focused article as read</td></tr>
              <tr><td>/</td><td>Focus the search field</td></tr>
              <tr><td>1-9</td><td>Jump to a section</td></tr>
              <tr><td>Esc</td><td>Close the reader, search, or focus ring</td></tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <main className="workspace" id="workspace" tabIndex={-1}>
        {managerOpen ? (
          <aside className="manager-panel" aria-label="Section and feed management">
            <div className="manager-pane manager-top-pane">
              <div className="manager-pane-scroll">
                <div className="manager-block">
                  <h2>Theme</h2>
                  <label className="theme-picker">
                    <span>App colour scheme</span>
                    <select
                      aria-label="App colour scheme"
                      value={colorScheme.id}
                      onChange={(event) => {
                        const theme = event.currentTarget.value as ColorSchemeId;
                        void run(() => updateColorScheme(theme));
                      }}
                    >
                      {COLOR_SCHEMES.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.label}</option>)}
                    </select>
                  </label>
                  <div className="theme-swatches" aria-hidden="true">
                    {colorScheme.colors.map((color, index) => <span key={index} style={{ backgroundColor: color }} />)}
                    <span style={{ backgroundColor: colorScheme.margin }} />
                  </div>
                </div>

                <div className="manager-block">
                  <h2>Sections</h2>
                  <div className="section-selector" role="list" aria-label="Sections">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        role="listitem"
                        className={section.id === selectedSection?.id ? 'section-tile selected' : 'section-tile'}
                        aria-pressed={section.id === selectedSection?.id}
                        onClick={() => {
                          setSelectedSectionId(section.id);
                          selectedSectionIdRef.current = section.id;
                          setManagerDetailsOpen(true);
                        }}
                      >
                        <strong>{section.name}</strong>
                        <span>
                          {section.feeds.length} feeds
                          {section.feeds.reduce((total, feed) => total + (feed.unread_count || 0), 0) > 0
                            ? ` - ${section.feeds.reduce((total, feed) => total + (feed.unread_count || 0), 0)} unread`
                            : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="inline-form">
                    <input value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="New section" />
                    <button type="button" onClick={() => void run(() => createSection())}>Create</button>
                  </div>
                  <div className="inline-form">
                    <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder="Rename selected section" disabled={!selectedSection} />
                    <button type="button" onClick={() => void run(() => renameSection())} disabled={!selectedSection}>Rename</button>
                  </div>
                  <div className="button-row">
                    <button type="button" onClick={() => void run(() => moveSection(-1))} disabled={!selectedSection}>Move up</button>
                    <button type="button" onClick={() => void run(() => moveSection(1))} disabled={!selectedSection}>Move down</button>
                    <button type="button" className="danger" onClick={() => void run(() => deleteSection())} disabled={!selectedSection}>Delete</button>
                  </div>
                </div>

                <div className="manager-block">
                  <h2>Feeds</h2>
                  <div className="inline-form stack-form">
                    <input
                      value={feedUrl}
                      onChange={(event) => { setFeedUrl(event.target.value); setFeedTest({ url: '', status: 'idle', message: '' }); }}
                      placeholder="https://example.com/feed.xml"
                      title={HELP_TEXT.feedUrl}
                      aria-label="RSS or Atom feed URL"
                      disabled={!selectedSection}
                    />
                    <input
                      value={feedInterval}
                      onChange={(event) => setFeedInterval(event.target.value)}
                      inputMode="numeric"
                      aria-label="Feed fetch interval in minutes"
                      placeholder="Feed fetch interval (minutes)"
                      title={HELP_TEXT.feedInterval}
                      disabled={!selectedSection}
                    />
                    <div className="button-row">
                      <button type="button" onClick={() => void testFeed()} disabled={!selectedSection || feedTest.status === 'testing'} title={HELP_TEXT.testFeed}>Test feed</button>
                      <button type="button" onClick={() => void addFeed()} disabled={!selectedSection || feedTest.status !== 'ok' || feedTest.url !== feedUrl.trim()} title={HELP_TEXT.addFeed}>Add feed</button>
                    </div>
                  </div>
                  {feedTest.message ? <p className={feedTest.status === 'error' ? 'form-message error' : 'form-message'}>{feedTest.message}</p> : null}
                </div>
                <div className="manager-block">
                  <h2>Keyboard</h2>
                  <div className="button-row">
                    <button type="button" onClick={() => toggleKeyboardShortcuts()}>
                      {keyboardShortcuts ? 'Disable keyboard shortcuts' : 'Enable keyboard shortcuts'}
                    </button>
                    {keyboardShortcuts ? <button type="button" onClick={() => setShortcutMapOpen(true)}>Key map</button> : null}
                  </div>
                  <p className="manager-note">Shortcuts move a focus ring between articles; they never fire while you are typing.</p>
                </div>
              </div>
            </div>

            {selectedSection ? (
              <div className={managerDetailsOpen ? 'manager-pane manager-bottom-pane open' : 'manager-pane manager-bottom-pane collapsed'}>
                <button
                  type="button"
                  className="manager-pane-toggle"
                  onClick={() => setManagerDetailsOpen((open) => !open)}
                  aria-expanded={managerDetailsOpen}
                  aria-label={managerDetailsOpen ? 'Collapse section tools' : 'Expand section tools'}
                >
                  {managerDetailsOpen ? <ChevronDownIcon aria-hidden="true" /> : <ChevronUpIcon aria-hidden="true" />}
                  <span>{selectedSection.name} tools</span>
                </button>
                {managerDetailsOpen ? (
                  <div className="manager-pane-scroll manager-bottom-scroll">
                    <div className="manager-block">
                      <h2>Layout</h2>
                      <div className="segmented">
                        {(['stack', 'mosaic'] as LayoutModeWire[]).map((mode) => (
                          <button key={mode} type="button" className={layout.mode === mode ? 'selected' : ''} onClick={() => void run(() => persistLayout({ ...layout, mode }))}>{mode}</button>
                        ))}
                      </div>
                      <button type="button" onClick={() => void run(() => resetLayout())}>Reset layout</button>
                    </div>

                    <div className="manager-block">
                      <h2>Appearance</h2>
                      <AppearanceEditor
                        key={selectedSection.key}
                        sectionKey={selectedSection.key}
                        appearance={appearance}
                        onApply={updateAppearanceForSection}
                        onError={setTransientError}
                      />
                    </div>

                    <div className="manager-block">
                      <h2>Data and diagnostics</h2>
                      <div className="button-row wrap">
                        <button type="button" onClick={() => void run(() => exportSubscriptions())}>Export OPML</button>
                        <label className="file-button">Import OPML<input type="file" accept=".opml,.xml,text/xml" onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void run(() => importSubscriptions(file));
                          event.currentTarget.value = '';
                        }} /></label>
                        <button type="button" onClick={() => void run(() => exportBackup())}>Back up database</button>
                        <button type="button" onClick={() => void run(() => exportDiagnosticBundle())}>Export diagnostics</button>
                      </div>
                      {dataMessage ? <p className="form-message" aria-live="polite">{dataMessage}</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        ) : null}

        <div className={styleForLayout(layout.mode)} data-layout-mode={layout.mode || 'stack'}>
          {sections.length === 0 ? (
            <div className="empty-app">No sections exist yet. Open Manage and create your first section.</div>
          ) : orderedSections.map((section, index) => {
            const state = items[section.id] || { loading: false, error: null, warning: null, items: [], hasOlder: false };
            const width = panelWidth(layout, section.key);
            const readerDocked = readerState !== null && readerState.dockSectionKey === section.key && readerState.tabs.length > 0;
            const shellStyle: React.CSSProperties = {
              '--panel-width': `${width}%`,
              order: index,
              ...(readerDocked && readerState.dockBounds ? { '--reader-dock-width': `${readerState.dockBounds.width + 12}px` } : {}),
            } as React.CSSProperties;
            return (
              <div
                key={section.key}
                ref={(node) => {
                  if (node) panelElements.current.set(section.key, node);
                  else panelElements.current.delete(section.key);
                }}
                className={readerDocked ? 'section-shell reader-open' : 'section-shell'}
                style={shellStyle}
                data-panel-id={section.key}
              >
                <SectionPanel
                  section={section}
                  items={state.items}
                  loading={state.loading}
                  error={state.error}
                  warning={state.warning}
                  hasOlder={state.hasOlder}
                  progress={syncProgress[section.id] ?? globalProgress}
                  appearance={layout.appearance?.[section.key]}
                  dayWindow={layout.dayWindows?.[section.key]}
                  onDayWindowChange={(sectionKey, days) => void run(() => updateSectionDayWindow(sectionKey, days))}
                  onRefresh={(sectionId) => void refreshSection(sectionId)}
                  onLoadOlder={(sectionId) => void loadOlder(sectionId)}
                  onMarkSeen={(sectionId) => void run(() => markSectionSeen(sectionId))}
                  onExportDiagnostics={() => void run(() => exportDiagnosticBundle())}
                  openItem={(sectionId, item) => void run(() => openItem(sectionId, item))}
                  onToggleImportant={(sectionId, item) => void run(() => toggleImportant(sectionId, item))}
                  onToggleMute={(feed, next) => void run(() => toggleMute(feed, next))}
                  onUpdateInterval={(feed, minutes) => void run(() => updateInterval(feed, minutes))}
                  onRemoveFeed={(feed) => void run(() => removeFeed(feed))}
                />
                <ResizeHandle label={`Resize ${section.name}`} onResizeStart={(clientX) => startResize(section.key, clientX)} />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
