// Optional helpers exposed on window for convenience; no imports/exports.
(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  const Store = (window as any).READIT.Store;
  (window as any).READIT.Queries = {
    subscribeSection(sectionId: number, cb: () => void) {
      return Store.subscribe(cb);
    },
    refreshSection(sectionId: number) {
      return Store.fetchItems(sectionId);
    },
    markSectionSeen(sectionId: number) {
      return Store.markSectionSeen(sectionId);
    },
  };
})();