import React from 'react';
import type { FeedWire, ItemWire, LayoutModeWire, LayoutWire, PreloadApi, SectionAppearanceWire, SectionWire, SyncProgressWire } from '../../shared/ipcTypes';
import { SectionPanel } from './SectionPanel';
import { ItemList } from './ItemList';
import { Toolbar } from './Toolbar';
import { ResizeHandle } from '../layout/DragHandle';
import { clampPanelWidth, movePanel, normalizeLayoutForSections, orderedSectionsForLayout, panelWidth, resetLayoutForSections, resizePanel } from '../layout/GridLayout';

declare global {
  interface Window {
    readit: PreloadApi;
  }
}

type ItemState = Record<number, { loading: boolean; error: string | null; items: ItemWire[] }>;
type FeedTestState = { url: string; status: 'idle' | 'testing' | 'ok' | 'error'; message: string };

function api() {
  if (!window.readit) throw new Error('READIT preload API unavailable');
  return window.readit;
}

function emptyItems(sections: SectionWire[]): ItemState {
  return Object.fromEntries(sections.map((section) => [section.id, { loading: false, error: null, items: [] }]));
}

function styleForLayout(mode: LayoutModeWire | undefined) {
  return `sections layout-${mode || 'stack'}`;
}

function selectedAppearance(layout: LayoutWire, section?: SectionWire): SectionAppearanceWire {
  if (!section) return { mode: 'solid', solid: '#161b22' };
  return layout.appearance?.[section.key] || { mode: 'solid', solid: '#161b22' };
}

async function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Select an image file'));
      return;
    }
    if (file.size > 1_500_000) {
      reject(new Error('Image must be 1.5 MB or smaller'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Image import failed'));
    reader.readAsDataURL(file);
  });
}

export function AppShell() {
  const [sections, setSections] = React.useState<SectionWire[]>([]);
  const [items, setItems] = React.useState<ItemState>({});
  const [layout, setLayoutState] = React.useState<LayoutWire>({ mode: 'stack', panels: [], appearance: {} });
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [selectedSectionId, setSelectedSectionId] = React.useState<number | null>(null);
  const [newSectionName, setNewSectionName] = React.useState('');
  const [renameValue, setRenameValue] = React.useState('');
  const [feedUrl, setFeedUrl] = React.useState('');
  const [feedInterval, setFeedInterval] = React.useState('30');
  const [feedTest, setFeedTest] = React.useState<FeedTestState>({ url: '', status: 'idle', message: '' });
  const [globalBusy, setGlobalBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchUnread, setSearchUnread] = React.useState(false);
  const [searchImportant, setSearchImportant] = React.useState(false);
  const [searchFeedId, setSearchFeedId] = React.useState('');
  const [searchDays, setSearchDays] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<ItemWire[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchVisible, setSearchVisible] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<Record<number, number>>({});
  const [globalProgress, setGlobalProgress] = React.useState<number | undefined>();
  const [dataMessage, setDataMessage] = React.useState('');
  const panelElements = React.useRef(new Map<string, HTMLDivElement>());

  const selectedSection = sections.find((section) => section.id === selectedSectionId) || sections[0];
  const orderedSections = React.useMemo(() => orderedSectionsForLayout(sections, layout), [sections, layout]);
  const appearance = selectedAppearance(layout, selectedSection);

  async function refreshSections(nextSelectedId?: number) {
    const response = await api().listSections();
    setSections(response.sections);
    setLayoutState((current) => normalizeLayoutForSections(current, response.sections));
    setItems((current) => ({ ...emptyItems(response.sections), ...current }));
    if (response.sections.length > 0) {
      const target = nextSelectedId && response.sections.some((section) => section.id === nextSelectedId)
        ? nextSelectedId
        : selectedSectionId && response.sections.some((section) => section.id === selectedSectionId)
          ? selectedSectionId
          : response.sections[0].id;
      setSelectedSectionId(target);
      setRenameValue(response.sections.find((section) => section.id === target)?.name || response.sections[0].name);
    } else {
      setSelectedSectionId(null);
      setRenameValue('');
    }
  }

  async function loadItems(sectionId: number) {
    setItems((current) => ({ ...current, [sectionId]: { ...(current[sectionId] || { items: [] }), loading: true, error: null } }));
    try {
      const response = await api().queryItems({ sectionId, limit: 100 });
      setItems((current) => ({ ...current, [sectionId]: { loading: false, error: null, items: response.items } }));
    } catch (err) {
      setItems((current) => ({
        ...current,
        [sectionId]: { ...(current[sectionId] || { items: [] }), loading: false, error: err instanceof Error ? err.message : String(err) },
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
      if (sectionsResponse.sections[0]) {
        setSelectedSectionId(sectionsResponse.sections[0].id);
        setRenameValue(sectionsResponse.sections[0].name);
      }
      await Promise.all(sectionsResponse.sections.map((section) => loadItems(section.id)));
      console.info('app_shell_ready sections=' + sectionsResponse.sections.length);
    } catch (err) {
      console.error('app_shell_initial_load_failed', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  React.useEffect(() => {
    void initialLoad();
  }, []);

  React.useEffect(() => {
    if (selectedSection) setRenameValue(selectedSection.name);
  }, [selectedSection?.id]);

  React.useEffect(() => {
    if (!window.readit) {
      setError('READIT preload API unavailable. Restart the application or rebuild the preload bundle.');
      return;
    }
    return window.readit.onSyncProgress?.((progress: SyncProgressWire) => {
      if (progress.sectionId) {
        setSyncProgress((current) => ({ ...current, [progress.sectionId as number]: progress.percent }));
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
    }) || (() => {});
  }, []);

  async function persistLayout(next: LayoutWire) {
    const normalized = normalizeLayoutForSections(next, sections);
    setLayoutState(normalized);
    const response = await api().setLayout({ layout: normalized });
    setLayoutState(normalizeLayoutForSections(response.layout, sections));
  }

  async function createSection() {
    const name = newSectionName.trim();
    if (!name) return;
    const response = await api().createSection({ name });
    setNewSectionName('');
    await refreshSections(response.section?.id);
    if (response.section?.id) await loadItems(response.section.id);
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
    const index = sections.findIndex((section) => section.id === selectedSection.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next.map((section, position_index) => ({ ...section, position_index })));
    await api().reorderSections({ sectionIds: next.map((section) => section.id) });
    await refreshSections(selectedSection.id);
  }

  async function testFeed() {
    const url = feedUrl.trim();
    if (!url) return;
    setFeedTest({ url, status: 'testing', message: 'Testing feed...' });
    const response = await api().testFeed({ url });
    if (response.status === 'ok') {
      setFeedTest({ url, status: 'ok', message: response.title ? `Valid feed: ${response.title}` : 'Valid RSS/Atom feed' });
    } else {
      setFeedTest({ url, status: 'error', message: response.error?.message || 'Feed validation failed' });
    }
  }

  async function addFeed() {
    if (!selectedSection || feedTest.status !== 'ok' || feedTest.url !== feedUrl.trim()) return;
    await api().addFeedToSection({
      sectionId: selectedSection.id,
      url: feedUrl.trim(),
      fetchIntervalMinutes: Number(feedInterval) || undefined,
      enabled: true,
    });
    setFeedUrl('');
    setFeedTest({ url: '', status: 'idle', message: '' });
    await refreshSections(selectedSection.id);
  }

  async function toggleFeed(feed: FeedWire) {
    await api().updateFeed({ feedId: feed.id, enabled: feed.is_enabled !== 1 });
    await refreshSections(selectedSection?.id);
  }

  async function removeFeed(feed: FeedWire) {
    if (!selectedSection) return;
    await api().removeFeedFromSection({ sectionId: selectedSection.id, feedId: feed.id });
    await refreshSections(selectedSection.id);
    await loadItems(selectedSection.id);
  }

  async function refreshSection(sectionId: number) {
    setItems((current) => ({ ...current, [sectionId]: { ...(current[sectionId] || { items: [] }), loading: true, error: null } }));
    const response = await api().syncTrigger({ sectionId });
    await refreshSections(sectionId);
    await loadItems(sectionId);
    if (response.errors > 0) {
      setItems((current) => ({
        ...current,
        [sectionId]: { ...(current[sectionId] || { items: [] }), loading: false, error: `${response.errors} feed refresh error(s)` },
      }));
    }
  }

  async function refreshAll() {
    setGlobalBusy(true);
    try {
      const response = await api().syncTrigger({});
      await refreshSections(selectedSection?.id);
      await loadAllItems();
      if (response.errors > 0) setError(`${response.errors} feed refresh error(s). Open feed status for details.`);
      else setError(null);
    } finally {
      setGlobalBusy(false);
    }
  }

  async function markSectionSeen(sectionId: number) {
    await api().markSectionSeen({ sectionId });
    await loadItems(sectionId);
    await refreshSections(sectionId);
  }

  async function openItem(sectionId: number, item: ItemWire) {
    if (!item.link) return;
    await api().markItemRead({ itemId: item.id });
    await api().openExternal({ url: item.link });
    if (sectionId > 0) await loadItems(sectionId);
    else await runSearch();
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
        ...(current[sectionId] || { loading: false, error: null, items: [] }),
        items: (current[sectionId]?.items || []).map((row) => row.id === item.id ? { ...row, is_important: response.is_important } : row),
      },
    }));
  }

  async function runSearch() {
    setSearching(true);
    try {
      const publishedAfter = searchDays
        ? new Date(Date.now() - Number(searchDays) * 86_400_000).toISOString()
        : undefined;
      const response = await api().queryItems({
        sectionId: -1,
        limit: 200,
        includeSeen: true,
        query: searchQuery.trim() || undefined,
        feedId: searchFeedId ? Number(searchFeedId) : undefined,
        unreadOnly: searchUnread || undefined,
        importantOnly: searchImportant || undefined,
        publishedAfter,
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
    setSearchResults([]);
    setSearchVisible(false);
  }

  async function toggleMute(feed: FeedWire) {
    await api().updateFeed({ feedId: feed.id, muted: feed.is_muted !== 1 });
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
  async function updateAppearance(next: SectionAppearanceWire) {
    if (!selectedSection) return;
    await persistLayout({
      ...layout,
      appearance: { ...(layout.appearance || {}), [selectedSection.key]: next },
    });
  }

  async function resetLayout() {
    await persistLayout(resetLayoutForSections(sections, layout.mode || 'stack', layout.appearance));
  }

  async function moveLayoutPanel(sectionKey: string, direction: -1 | 1) {
    await persistLayout(movePanel(layout, sectionKey, direction));
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
      await persistLayout(resizePanel(layout, sectionKey, previewWidth));
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
      <Toolbar busy={globalBusy} onRefreshAll={() => void refreshAll()} onOpenManager={() => setManagerOpen((open) => !open)} />
      {error ? <div className="app-error" role="alert">{error}</div> : null}

      <section className="search-toolbar" aria-label="Search local articles">
        <label className="search-field"><span>Search</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runSearch(); }} placeholder="Title, summary, or source" /></label>
        <label><span>Source</span><select value={searchFeedId} onChange={(event) => setSearchFeedId(event.target.value)}><option value="">All feeds</option>{sections.flatMap((section) => section.feeds).filter((feed, index, all) => all.findIndex((row) => row.id === feed.id) === index).map((feed) => <option key={feed.id} value={feed.id}>{feed.title || feed.url}</option>)}</select></label>
        <label><span>Date</span><select value={searchDays} onChange={(event) => setSearchDays(event.target.value)}><option value="">Any time</option><option value="1">Past day</option><option value="7">Past week</option><option value="30">Past month</option></select></label>
        <label className="check-field"><input type="checkbox" checked={searchUnread} onChange={(event) => setSearchUnread(event.target.checked)} /> Unread</label>
        <label className="check-field"><input type="checkbox" checked={searchImportant} onChange={(event) => setSearchImportant(event.target.checked)} /> Important</label>
        <button type="button" className="primary" onClick={() => void runSearch()} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
        <button type="button" onClick={clearSearch}>Clear</button>
      </section>

      {searchVisible ? <section className="search-results" aria-label="Search results"><header><h2>Local results</h2><span>{searchResults.length} item(s)</span><button type="button" onClick={() => setSearchVisible(false)}>Close</button></header><div className="search-results-scroll"><ItemList sectionId={-1} items={searchResults} openExternalItem={(sectionId, item) => void openItem(sectionId, item)} onToggleImportant={(sectionId, item) => void toggleImportant(sectionId, item)} /></div></section> : null}

      <main className="workspace" id="workspace" tabIndex={-1}>
        {managerOpen ? (
          <aside className="manager-panel" aria-label="Section and feed management">
            <div className="manager-block">
              <h2>Sections</h2>
              <div className="section-selector">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={section.id === selectedSection?.id ? 'selected' : ''}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    {section.name}
                  </button>
                ))}
              </div>
              <div className="inline-form">
                <input value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="New section" />
                <button type="button" onClick={() => void createSection()}>Create</button>
              </div>
              <div className="inline-form">
                <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder="Rename section" />
                <button type="button" onClick={() => void renameSection()} disabled={!selectedSection}>Rename</button>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => void moveSection(-1)} disabled={!selectedSection}>Move up</button>
                <button type="button" onClick={() => void moveSection(1)} disabled={!selectedSection}>Move down</button>
                <button type="button" className="danger" onClick={() => void deleteSection()} disabled={!selectedSection}>Delete</button>
              </div>
            </div>

            <div className="manager-block">
              <h2>Feeds</h2>
              <div className="inline-form stack-form">
                <input value={feedUrl} onChange={(event) => { setFeedUrl(event.target.value); setFeedTest({ url: '', status: 'idle', message: '' }); }} placeholder="https://example.com/feed.xml" />
                <input value={feedInterval} onChange={(event) => setFeedInterval(event.target.value)} inputMode="numeric" placeholder="Interval minutes" />
                <div className="button-row">
                  <button type="button" onClick={() => void testFeed()} disabled={!selectedSection || feedTest.status === 'testing'}>Test feed</button>
                  <button type="button" onClick={() => void addFeed()} disabled={!selectedSection || feedTest.status !== 'ok' || feedTest.url !== feedUrl.trim()}>Add feed</button>
                </div>
              </div>
              {feedTest.message ? <p className={feedTest.status === 'error' ? 'form-message error' : 'form-message'}>{feedTest.message}</p> : null}
            </div>

            <div className="manager-block">
              <h2>Layout</h2>
              <div className="segmented">
                {(['stack', 'columns', 'mosaic', 'focus'] as LayoutModeWire[]).map((mode) => (
                  <button key={mode} type="button" className={layout.mode === mode ? 'selected' : ''} onClick={() => void persistLayout({ ...layout, mode })}>{mode}</button>
                ))}
              </div>
              <button type="button" onClick={() => void resetLayout()}>Reset layout</button>
            </div>

            <div className="manager-block">
              <h2>Appearance</h2>
              <div className="segmented">
                {(['solid', 'gradient', 'image'] as SectionAppearanceWire['mode'][]).map((mode) => (
                  <button key={mode} type="button" className={appearance.mode === mode ? 'selected' : ''} onClick={() => void updateAppearance({ ...appearance, mode })}>{mode}</button>
                ))}
              </div>
              <label>Solid <input type="color" value={appearance.solid || '#161b22'} onChange={(event) => void updateAppearance({ ...appearance, mode: 'solid', solid: event.target.value })} /></label>
              <label>Gradient from <input type="color" value={appearance.gradientFrom || '#243447'} onChange={(event) => void updateAppearance({ ...appearance, mode: 'gradient', gradientFrom: event.target.value })} /></label>
              <label>Gradient to <input type="color" value={appearance.gradientTo || '#14532d'} onChange={(event) => void updateAppearance({ ...appearance, mode: 'gradient', gradientTo: event.target.value })} /></label>
              <label>Picture <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void readImageAsDataUrl(file).then((imageDataUrl) => updateAppearance({ ...appearance, mode: 'image', imageDataUrl })).catch((err) => setError(err instanceof Error ? err.message : String(err)));
              }} /></label>
            </div>

            <div className="manager-block">
              <h2>Data and diagnostics</h2>
              <div className="button-row wrap">
                <button type="button" onClick={() => void exportSubscriptions()}>Export OPML</button>
                <label className="file-button">Import OPML<input type="file" accept=".opml,.xml,text/xml" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void importSubscriptions(file).catch((err) => setError(err instanceof Error ? err.message : String(err)));
                  event.currentTarget.value = '';
                }} /></label>
                <button type="button" onClick={() => void exportBackup()}>Back up database</button>
                <button type="button" onClick={() => void exportDiagnosticBundle()}>Export diagnostics</button>
              </div>
              {dataMessage ? <p className="form-message" aria-live="polite">{dataMessage}</p> : null}
            </div>
          </aside>
        ) : null}

        <div className={styleForLayout(layout.mode)} data-layout-mode={layout.mode || 'stack'}>
          {sections.length === 0 ? (
            <div className="empty-app">No sections exist yet. Open Manage and create your first section.</div>
          ) : orderedSections.map((section, index) => {
            const state = items[section.id] || { loading: false, error: null, items: [] };
            const width = panelWidth(layout, section.key);
            return (
              <div
                key={section.key}
                ref={(node) => {
                  if (node) panelElements.current.set(section.key, node);
                  else panelElements.current.delete(section.key);
                }}
                className="section-shell"
                style={{ '--panel-width': `${width}%`, order: index } as React.CSSProperties}
                data-panel-id={section.key}
              >
                <div className="panel-controls" aria-label={`${section.name} panel controls`}>
                  <button type="button" onClick={() => void moveLayoutPanel(section.key, -1)} disabled={index === 0}>Move left</button>
                  <button type="button" onClick={() => void moveLayoutPanel(section.key, 1)} disabled={index === orderedSections.length - 1}>Move right</button>
                  <span>{width}%</span>
                </div>
                <SectionPanel
                  section={section}
                  items={state.items}
                  loading={state.loading}
                  error={state.error}
                  progress={syncProgress[section.id] ?? globalProgress}
                  appearance={layout.appearance?.[section.key]}
                  onRefresh={(sectionId) => void refreshSection(sectionId)}
                  onMarkSeen={(sectionId) => void markSectionSeen(sectionId)}
                  openExternalItem={(sectionId, item) => void openItem(sectionId, item)}
                  onToggleImportant={(sectionId, item) => void toggleImportant(sectionId, item)}
                  onToggleFeed={(feed) => void toggleFeed(feed)}
                  onToggleMute={(feed) => void toggleMute(feed)}
                  onUpdateInterval={(feed, minutes) => void updateInterval(feed, minutes)}
                  onRemoveFeed={(feed) => void removeFeed(feed)}
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