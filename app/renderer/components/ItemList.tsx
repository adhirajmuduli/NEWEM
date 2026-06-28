import React from 'react';
import type { ItemWire } from '../../shared/ipcTypes';

function fmtTime(iso?: string | null): string {
  if (!iso) return 'No date';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleString();
}

function stripUnsafeHtml(html?: string | null) {
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
  if (props.items.length === 0) {
    return <div className="state-card">No unread items. Refresh the section or add feeds to bring news here.</div>;
  }

  return (
    <div className="item-list" aria-label="News items">
      {props.items.map((item) => (
        <article key={item.id} className={item.is_read ? 'item-card read' : 'item-card'}>
          <div className="item-topline">
            <span>{item.feed_title || 'Unknown feed'}</span>
            <span>{fmtTime(item.published_at)}</span>
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
          {item.description ? <p className="item-desc">{stripUnsafeHtml(item.description)}</p> : null}
          <div className="item-actions">
            <button type="button" onClick={() => props.openExternalItem(props.sectionId, item)}>Open</button>
            <button
              type="button"
              className={item.is_important ? 'important active' : 'important'}
              onClick={() => props.onToggleImportant(props.sectionId, item)}
              aria-pressed={item.is_important === 1}
            >
              {item.is_important ? 'Important' : 'Mark important'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
