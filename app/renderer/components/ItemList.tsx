import React from 'react';
import type { ItemWire } from '../../shared/ipcTypes';
import { BentoGrid } from './ui/bento-grid';

const RENDER_BATCH_SIZE = 80;

function fmtTime(iso?: string | null): string {
  if (!iso) return 'No date';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleString();
}

export function plainTextFromFeedContent(html?: string | null) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((node) => node.remove());
  doc.querySelectorAll('*').forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) node.removeAttribute(attr.name);
    }
  });
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function ItemList(props: {
  sectionId: number;
  items: ItemWire[];
  openExternalItem(sectionId: number, item: ItemWire): void;
  onToggleImportant(sectionId: number, item: ItemWire): void;
}) {
  const [visibleCount, setVisibleCount] = React.useState(() => Math.min(RENDER_BATCH_SIZE, props.items.length));
  const loadMoreRef = React.useRef<HTMLButtonElement>(null);
  const hasMore = visibleCount < props.items.length;

  React.useEffect(() => {
    setVisibleCount((current) => Math.min(props.items.length, Math.max(current, Math.min(RENDER_BATCH_SIZE, props.items.length))));
  }, [props.items.length]);

  React.useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const root = target.closest('.section-feed-scroll, .search-results-scroll');
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(props.items.length, current + RENDER_BATCH_SIZE));
      }
    }, { root, rootMargin: '320px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, props.items.length, visibleCount]);

  if (props.items.length === 0) {
    return <div className="state-card">No unread items. Refresh the section or add feeds to bring news here.</div>;
  }

  return (
    <>
      <BentoGrid className="item-list" aria-label="News items">
        {props.items.slice(0, visibleCount).map((item, index) => (
          <article
            key={item.id}
            data-featured={index % 7 === 0 ? 'true' : undefined}
            className={item.is_read ? 'item-card glass-card read' : 'item-card glass-card'}
          >
            <div className="item-topline">
              <span className="item-source">{item.feed_title || 'Unknown feed'}</span>
              <time dateTime={item.published_at || undefined}>{fmtTime(item.published_at)}</time>
              <button
                type="button"
                className={item.is_important ? 'important-toggle active' : 'important-toggle'}
                onClick={() => props.onToggleImportant(props.sectionId, item)}
                aria-label={item.is_important ? 'Remove important mark' : 'Mark important'}
                aria-pressed={item.is_important === 1}
                title={item.is_important ? 'Remove important mark' : 'Mark important'}
              >
                i
              </button>
            </div>
            <a
              href={item.link || '#'}
              className="item-title"
              onClick={(e) => {
                e.preventDefault();
                props.openExternalItem(props.sectionId, item);
              }}
            >
              {item.title || '(untitled)'}
            </a>
            {item.description ? <p className="item-desc">{plainTextFromFeedContent(item.description)}</p> : null}
          </article>
        ))}
      </BentoGrid>
      {hasMore ? (
        <button
          ref={loadMoreRef}
          type="button"
          className="load-more-items"
          onClick={() => setVisibleCount((current) => Math.min(props.items.length, current + RENDER_BATCH_SIZE))}
        >
          Load more news
        </button>
      ) : null}
    </>
  );
}
