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

  // Step 9: mark a single item as read, then refresh section to honor visibility rules
  async markItemRead(sectionId: number, itemId: number) {
    try {
      await api.markItemRead({ itemId });
    } finally {
      // Always refresh to enforce: read hidden unless important
      await store.fetchItems(sectionId);
    }
  },

  // Step 9: toggle important flag, then refresh section
  async toggleItemImportant(sectionId: number, itemId: number) {
    const sec = ensureSection(sectionId);

    // Optimistic update
    sec.items = sec.items.map(it =>
        it.id === itemId
        ? { ...it, is_important: it.is_important ? 0 : 1 }
        : it
    );
    notify();

    try {
        await api.toggleItemImportant({ itemId });
    } catch {
        // Optional: revert on failure
    }
  },

  // Step 9: fetch all important items into a virtual section (-1)
  async fetchImportant() {
    const sectionId = -1;
    const sec = ensureSection(sectionId);
    sec.loading = true;
    sec.error = null;
    notify();

    try {
      const res = await api.queryImportant({});
      sec.items = res.items as READIT.ItemWire[];
    } catch (e) {
      sec.error = e instanceof Error ? e.message : String(e);
    } finally {
      sec.loading = false;
      notify();
    }
  },
};

(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Store = store;
})();
