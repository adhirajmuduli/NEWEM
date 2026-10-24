import { describe, expect, it, vi } from 'vitest';
import { ReaderManager, type ReaderDependencies, type ReaderHostWindow, type ReaderViewHandle } from '../../app/main/reader';
import { READER_TAB_STRIP_HEIGHT } from '../../app/shared/ipcTypes';

type RecordedView = {
  view: ReaderViewHandle;
  setBounds: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  loadURL: ReturnType<typeof vi.fn>;
  setWindowOpenHandler: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

function makeView(): RecordedView {
  const setBounds = vi.fn();
  const setVisible = vi.fn();
  const destroy = vi.fn();
  const loadURL = vi.fn(async () => undefined);
  const setWindowOpenHandler = vi.fn();
  const on = vi.fn();
  const view = {
    setBounds,
    setVisible,
    webContents: { loadURL, setWindowOpenHandler, on, destroy, isDestroyed: () => false },
  } as unknown as ReaderViewHandle;
  return { view, setBounds, setVisible, destroy, loadURL, setWindowOpenHandler, on };
}

function makeDeps() {
  const views: RecordedView[] = [];
  const deps: ReaderDependencies = {
    createView: () => {
      const recorded = makeView();
      views.push(recorded);
      return recorded.view;
    },
  };
  return { deps, views };
}

function makeHost() {
  const sent: Array<[string, unknown]> = [];
  const addChildView = vi.fn();
  const removeChildView = vi.fn();
  const host = {
    webContents: { send: (channel: string, payload: unknown) => sent.push([channel, payload]) },
    contentView: { addChildView, removeChildView },
    getContentBounds: () => ({ x: 0, y: 0, width: 1280, height: 800 }),
  } as ReaderHostWindow;
  return { host, sent, addChildView, removeChildView };
}

const BOUNDS = { x: 600, y: 40, width: 640, height: 720 };

describe('embedded reader manager', () => {
  it('opens a tab, clamps the dock to the window, and positions the view below the strip', () => {
    const { deps, views } = makeDeps();
    const { host, sent } = makeHost();
    const manager = new ReaderManager(deps);
    manager.attach(host);

    const state = manager.open({ sectionKey: 'world', url: 'https://example.com/article', title: 'Article', bounds: { x: 600, y: 40, width: 900, height: 900 } });

    expect(views).toHaveLength(1);
    expect(views[0].setBounds).toHaveBeenCalledWith({
      x: 600,
      y: 40 + READER_TAB_STRIP_HEIGHT,
      width: 680,
      height: 800 - 40 - READER_TAB_STRIP_HEIGHT,
    });
    expect(views[0].setVisible).toHaveBeenCalledWith(true);
    expect(views[0].loadURL).toHaveBeenCalledWith('https://example.com/article');
    expect(host.contentView.addChildView).toHaveBeenCalledWith(views[0].view);
    expect(state).toMatchObject({
      tabs: [{ tabId: 1, url: 'https://example.com/article', title: 'Article', sectionKey: 'world' }],
      activeTabId: 1,
      dockSectionKey: 'world',
      dockBounds: { x: 600, y: 40, width: 680, height: 760 },
    });
    expect(sent.some(([channel]) => channel === 'reader:state')).toBe(true);
  });

  it('rejects non-browsable URLs', () => {
    const { deps, views } = makeDeps();
    const manager = new ReaderManager(deps);
    manager.attach(makeHost().host);

    expect(() => manager.open({ sectionKey: 'world', url: 'file:///etc/passwd', title: 'Bad', bounds: BOUNDS })).toThrow();
    expect(() => manager.open({ sectionKey: 'world', url: 'http://localhost/admin', title: 'Bad', bounds: BOUNDS })).toThrow();
    expect(views).toHaveLength(0);
    expect(manager.state()).toBeNull();
  });

  it('activates the existing tab when the same URL is opened again', () => {
    const { deps, views } = makeDeps();
    const manager = new ReaderManager(deps);
    manager.attach(makeHost().host);
    manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'First', bounds: BOUNDS });
    const second = manager.open({ sectionKey: 'india', url: 'https://example.com/a', title: 'Second', bounds: BOUNDS });

    expect(views).toHaveLength(1);
    expect(second?.tabs).toHaveLength(1);
    expect(second?.tabs[0].sectionKey).toBe('india');
    expect(second?.activeTabId).toBe(1);
  });

  it('turns popup windows into new reader tabs while denying the native popup', () => {
    const { deps, views } = makeDeps();
    const manager = new ReaderManager(deps);
    manager.attach(makeHost().host);
    manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'First', bounds: BOUNDS });

    const openHandler = views[0].setWindowOpenHandler.mock.calls[0][0] as (details: { url: string }) => { action: string };
    const outcome = openHandler({ url: 'https://example.com/popup' });
    expect(outcome).toEqual({ action: 'deny' });
    expect(manager.state()?.tabs).toHaveLength(2);
    expect(manager.state()?.activeTabId).toBe(2);
  });

  it('blocks non-http navigation inside reader tabs', () => {
    const { deps, views } = makeDeps();
    const manager = new ReaderManager(deps);
    manager.attach(makeHost().host);
    manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'First', bounds: BOUNDS });

    const registration = views[0].on.mock.calls.find(([event]) => event === 'will-navigate') as unknown as [string, (event: { preventDefault(): void }, url: string) => void];
    expect(registration).toBeTruthy();
    const preventDefault = vi.fn();
    registration[1]({ preventDefault }, 'file:///etc/passwd');
    expect(preventDefault).toHaveBeenCalledTimes(1);
    const allowed = vi.fn();
    registration[1]({ preventDefault: allowed }, 'https://example.com/next');
    expect(allowed).not.toHaveBeenCalled();
  });

  it('activates the neighbouring tab when the active tab closes', () => {
    const { deps, views } = makeDeps();
    const manager = new ReaderManager(deps);
    manager.attach(makeHost().host);
    manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'A', bounds: BOUNDS });
    manager.open({ sectionKey: 'world', url: 'https://example.com/b', title: 'B', bounds: BOUNDS });
    expect(manager.state()?.tabs).toHaveLength(2);

    const state = manager.closeTab(2);

    expect(state?.activeTabId).toBe(1);
    expect(views[1].destroy).toHaveBeenCalled();
    expect(views[0].destroy).not.toHaveBeenCalled();
    expect(views[0].setVisible).toHaveBeenLastCalledWith(true);
  });

  it('clears the dock entirely when the last tab closes', () => {
    const { deps } = makeDeps();
    const manager = new ReaderManager(deps);
    manager.attach(makeHost().host);
    manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'A', bounds: BOUNDS });

    const state = manager.closeTab(1);

    expect(state).toBeNull();
    expect(manager.state()).toBeNull();
  });

  it('destroys every view on closeAll and detaches them from the window', () => {
    const { deps, views } = makeDeps();
    const { host, removeChildView } = makeHost();
    const manager = new ReaderManager(deps);
    manager.attach(host);
    manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'A', bounds: BOUNDS });
    manager.open({ sectionKey: 'world', url: 'https://example.com/b', title: 'B', bounds: BOUNDS });

    expect(manager.closeAll()).toBeNull();
    expect(views.map((view) => view.destroy)).toHaveLength(2);
    for (const view of views) expect(view.destroy).toHaveBeenCalled();
    expect(removeChildView).toHaveBeenCalledTimes(2);
  });

  it('repositions without creating tabs and keeps only the active view visible', () => {
    const { deps, views } = makeDeps();
    const manager = new ReaderManager(deps);
    manager.attach(makeHost().host);
    manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'A', bounds: BOUNDS });
    manager.open({ sectionKey: 'world', url: 'https://example.com/b', title: 'B', bounds: BOUNDS });
    views.forEach((view) => view.setBounds.mockClear());

    const state = manager.reposition({ sectionKey: 'world', bounds: { x: 0, y: 0, width: 1280, height: 800 } });

    expect(state?.dockBounds).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
    expect(state?.activeTabId).toBe(2);
    for (const view of views) {
      expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: READER_TAB_STRIP_HEIGHT, width: 1280, height: 800 - READER_TAB_STRIP_HEIGHT });
    }
  });

  it('survives a missing host window', () => {
    const { deps } = makeDeps();
    const manager = new ReaderManager(deps);
    const state = manager.open({ sectionKey: 'world', url: 'https://example.com/a', title: 'A', bounds: BOUNDS });
    expect(state).toMatchObject({ tabs: [{ tabId: 1 }] });
    expect(manager.closeAll()).toBeNull();
  });
});
