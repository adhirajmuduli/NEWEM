export {};

declare const React: any;
declare const ReactDOM: any;

declare global {
  namespace READIT {
    /* ---------- shared primitives ---------- */

    type Listener = () => void;

    /* ---------- item coming over IPC / wire ---------- */

    interface ItemWire {
      id: number;
      title?: string | null;
      link?: string | null;
      description?: string | null;
      feed_title?: string | null;
      published_at?: string | null;
      seen_at?: string | null;
      is_read?: 0 | 1;
      is_important?: 0 | 1;
    }

    /* ---------- section state ---------- */

    interface SectionState {
      items: ItemWire[];
      loading: boolean;
      error: string | null;
    }

    /* ---------- store root ---------- */

    interface StoreState {
      sections: Map<number, SectionState>;
    }

    /* ---------- component registry ---------- */

    namespace Components {
      const AppShell: any;
      const ItemList: any;
    }

    /* ---------- store API ---------- */

    interface Store {
      subscribe(fn: Listener): () => void;
      getItems(sectionId: number): ItemWire[];
      isLoading(sectionId: number): boolean;
      getError(sectionId: number): string | null;
      fetchItems(sectionId: number): Promise<void>;
      markSectionSeen(sectionId: number): Promise<void>;
    }

    const Store: Store;
  }
}
