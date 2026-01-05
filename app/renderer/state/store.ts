// store.ts — browser store (no imports/exports)

const state: READIT.StoreState = {
  sections: new Map(),
};

const listeners = new Set<READIT.Listener>();

function ensureSection(sectionId: number): READIT.SectionState {
  if (!state.sections.has(sectionId)) {
    state.sections.set(sectionId, { items: [], loading: false, error: null });
  }
  return state.sections.get(sectionId)!;
}

function notify() {
  for (const l of listeners) l();
}

const api = (window as any).readit;

const store = {
  subscribe(fn: READIT.Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getItems(sectionId: number): READIT.ItemWire[] {
    return ensureSection(sectionId).items;
  },

  isLoading(sectionId: number): boolean {
    return ensureSection(sectionId).loading;
  },

  getError(sectionId: number): string | null {
    return ensureSection(sectionId).error;
  },

  async fetchItems(sectionId: number) {
    const sec = ensureSection(sectionId);
    sec.loading = true;
    sec.error = null;
    notify();

    try {
      const res = await api.queryItems({ sectionId });
      sec.items = res.items;
    } catch (e) {
      sec.error = e instanceof Error ? e.message : String(e);
    } finally {
      sec.loading = false;
      notify();
    }
  },

  async markSectionSeen(sectionId: number) {
    const sec = ensureSection(sectionId);
    try {
      const r = await api.markSectionSeen({ sectionId });
      if (r.changed > 0) {
        const ts = new Date().toISOString();
        sec.items = sec.items.map((it: READIT.ItemWire) => ({
          ...it,
          seen_at: it.seen_at ?? ts,
        }));
        notify();
      }
    } catch (e) {
      sec.error = e instanceof Error ? e.message : String(e);
      notify();
    }
  },
};

(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Store = store;
})();
