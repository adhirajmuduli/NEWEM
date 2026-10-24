// Embedded article reader: an isolated, tabbed WebContentsView docked to a section panel.
declare const require: any;

import { READER_TAB_STRIP_HEIGHT, type ReaderBoundsWire, type ReaderStateWire } from '../shared/ipcTypes';
import { normalizeFeedUrl } from '../core/rss/url';
import { withModule } from './logging';

const electron = (() => {
  try {
    return require('electron');
  } catch {
    return null;
  }
})();

const WebContentsView: any = electron?.WebContentsView;
const session: any = electron?.session;

const log = withModule('reader');

export type ReaderHostWindow = {
  webContents: { send(channel: string, payload: unknown): void };
  contentView: { addChildView(view: unknown): void; removeChildView(view: unknown): void };
  getContentBounds(): { x: number; y: number; width: number; height: number };
};

export type ReaderViewHandle = {
  setBounds(bounds: ReaderBoundsWire): void;
  setVisible(visible: boolean): void;
  webContents: {
    loadURL(url: string): Promise<void> | void;
    setWindowOpenHandler(handler: (details: { url: string }) => { action: string }): void;
    on(event: string, listener: (...args: any[]) => void): void;
    isDestroyed?(): boolean;
    destroy?(): void;
  };
};

export type ReaderDependencies = {
  createView(): ReaderViewHandle;
};

let readerSession: any = null;

function ensureReaderSession(): unknown {
  if (!session) return undefined;
  if (!readerSession) {
    readerSession = session.fromPartition('readit-reader');
    if (typeof readerSession.setPermissionRequestHandler === 'function') {
      readerSession.setPermissionRequestHandler((_wc: unknown, _permission: string, callback: (granted: boolean) => void) => callback(false));
    }
    if (typeof readerSession.setPermissionCheckHandler === 'function') {
      readerSession.setPermissionCheckHandler(() => false);
    }
  }
  return readerSession;
}

const defaultDependencies: ReaderDependencies = {
  createView: () =>
    new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        session: ensureReaderSession(),
      },
    }) as ReaderViewHandle,
};

function browsableUrl(url: string) {
  const result = normalizeFeedUrl(url, { preserveTrailingSlash: true });
  if (!result.ok) throw new Error(result.message);
  return result.url;
}

function disposeView(tabId: number, view: ReaderViewHandle) {
  const webContents = view.webContents;
  try {
    if (typeof webContents.isDestroyed === 'function' && webContents.isDestroyed()) return;
    if (typeof webContents.destroy === 'function') webContents.destroy();
  } catch (error) {
    log.warn('reader_view_destroy_failed', { tabId, error: error instanceof Error ? error.message : String(error) });
  }
}

type ReaderTab = {
  tabId: number;
  url: string;
  title: string;
  sectionKey: string;
  view: ReaderViewHandle;
};

export class ReaderManager {
  private tabs: ReaderTab[] = [];
  private nextTabId = 1;
  private host: ReaderHostWindow | null = null;
  private activeTabId: number | null = null;
  private dockSectionKey: string | null = null;
  private dockBounds: ReaderBoundsWire | null = null;

  constructor(private readonly deps: ReaderDependencies = defaultDependencies) {}

  attach(host: ReaderHostWindow | null) {
    this.host = host;
  }

  detach() {
    this.closeAll();
    this.host = null;
  }

  private emitState() {
    const host = this.host;
    if (host) host.webContents.send('reader:state', this.state());
  }

  state(): ReaderStateWire | null {
    if (this.tabs.length === 0) return null;
    return {
      tabs: this.tabs.map((tab) => ({ tabId: tab.tabId, url: tab.url, title: tab.title, sectionKey: tab.sectionKey })),
      activeTabId: this.activeTabId,
      dockSectionKey: this.dockSectionKey,
      dockBounds: this.dockBounds,
    };
  }

  private clampBounds(bounds: ReaderBoundsWire): ReaderBoundsWire {
    const host = this.host;
    const content = host ? host.getContentBounds() : null;
    const maxWidth = content ? Math.max(0, content.width - bounds.x) : bounds.width;
    const maxHeight = content ? Math.max(0, content.height - bounds.y) : bounds.height;
    return {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.min(Math.round(bounds.width), Math.round(maxWidth))),
      height: Math.max(0, Math.min(Math.round(bounds.height), Math.round(maxHeight))),
    };
  }

  private applyBounds() {
    if (!this.dockBounds) return;
    const clamped = this.clampBounds(this.dockBounds);
    const viewBounds = {
      x: clamped.x,
      y: clamped.y + READER_TAB_STRIP_HEIGHT,
      width: clamped.width,
      height: Math.max(0, clamped.height - READER_TAB_STRIP_HEIGHT),
    };
    for (const tab of this.tabs) tab.view.setBounds(viewBounds);
  }

  private setActiveTabId(tabId: number | null) {
    this.activeTabId = tabId;
    for (const tab of this.tabs) tab.view.setVisible(tab.tabId === tabId);
  }

  open(payload: { sectionKey: string; url: string; title: string; bounds: ReaderBoundsWire }): ReaderStateWire | null {
    const url = browsableUrl(payload.url);
    this.dockSectionKey = payload.sectionKey;
    this.dockBounds = this.clampBounds(payload.bounds);
    this.applyBounds();

    const existing = this.tabs.find((tab) => tab.url === url);
    if (existing) {
      existing.sectionKey = payload.sectionKey;
      existing.title = payload.title || existing.title;
      this.setActiveTabId(existing.tabId);
      this.emitState();
      return this.state();
    }

    const view = this.deps.createView();
    const tab: ReaderTab = {
      tabId: this.nextTabId++,
      url,
      title: payload.title,
      sectionKey: payload.sectionKey,
      view,
    };
    this.tabs.push(tab);

    view.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      try {
        const normalized = browsableUrl(popupUrl);
        this.open({ sectionKey: tab.sectionKey, url: normalized, title: tab.title, bounds: this.dockBounds ?? payload.bounds });
      } catch (error) {
        log.warn('reader_popup_blocked', { url: popupUrl, error: error instanceof Error ? error.message : String(error) });
      }
      return { action: 'deny' };
    });
    view.webContents.on('will-navigate', (event: unknown, nextUrl: string) => {
      try {
        browsableUrl(nextUrl);
      } catch {
        (event as { preventDefault(): void }).preventDefault();
        log.warn('reader_navigation_blocked', { nextUrl });
      }
    });

    const host = this.host;
    if (host) host.contentView.addChildView(view);
    Promise.resolve(view.webContents.loadURL(url)).catch((error: unknown) => {
      log.warn('reader_load_failed', { tabId: tab.tabId, url, error: error instanceof Error ? error.message : String(error) });
    });

    this.setActiveTabId(tab.tabId);
    this.applyBounds();
    this.emitState();
    return this.state();
  }

  activate(tabId: number): ReaderStateWire | null {
    if (!this.tabs.some((tab) => tab.tabId === tabId)) return this.state();
    this.setActiveTabId(tabId);
    this.emitState();
    return this.state();
  }

  closeTab(tabId: number): ReaderStateWire | null {
    const index = this.tabs.findIndex((tab) => tab.tabId === tabId);
    if (index === -1) return this.state();
    const [closed] = this.tabs.splice(index, 1);
    const host = this.host;
    try {
      if (host) host.contentView.removeChildView(closed.view);
    } catch (error) {
      log.warn('reader_view_detach_failed', { tabId, error: error instanceof Error ? error.message : String(error) });
    }
    disposeView(tabId, closed.view);

    if (this.tabs.length === 0) {
      this.activeTabId = null;
      this.dockSectionKey = null;
      this.dockBounds = null;
    } else if (this.activeTabId === tabId) {
      const next = this.tabs[Math.max(0, index - 1)] ?? this.tabs[this.tabs.length - 1];
      this.setActiveTabId(next.tabId);
    }
    this.emitState();
    return this.state();
  }

  closeAll(): ReaderStateWire | null {
    for (const tab of [...this.tabs]) {
      const host = this.host;
      try {
        if (host) host.contentView.removeChildView(tab.view);
      } catch (error) {
        log.warn('reader_view_detach_failed', { tabId: tab.tabId, error: error instanceof Error ? error.message : String(error) });
      }
      disposeView(tab.tabId, tab.view);
    }
    this.tabs = [];
    this.activeTabId = null;
    this.dockSectionKey = null;
    this.dockBounds = null;
    this.emitState();
    return this.state();
  }

  reposition(payload: { sectionKey: string; bounds: ReaderBoundsWire }): ReaderStateWire | null {
    if (this.tabs.length === 0) return this.state();
    this.dockSectionKey = payload.sectionKey;
    this.dockBounds = this.clampBounds(payload.bounds);
    this.applyBounds();
    this.emitState();
    return this.state();
  }
}

export function readerHostForWindow(window: {
  webContents: ReaderHostWindow['webContents'];
  contentView: ReaderHostWindow['contentView'];
  getContentBounds(): { x: number; y: number; width: number; height: number };
}): ReaderHostWindow {
  return {
    webContents: window.webContents,
    contentView: window.contentView,
    getContentBounds: window.getContentBounds.bind(window),
  };
}

export const reader = new ReaderManager();
