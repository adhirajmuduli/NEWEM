import React from 'react';
import type { FeedWire, ItemWire, SectionAppearanceWire, SectionWire } from '../../shared/ipcTypes';
import { ItemList } from './ItemList';

type SectionPanelProps = {
  section: SectionWire;
  items: ItemWire[];
  loading: boolean;
  error: string | null;
  progress?: number;
  appearance?: SectionAppearanceWire;
  onRefresh(sectionId: number): void;
  onMarkSeen(sectionId: number): void;
  openExternalItem(sectionId: number, item: ItemWire): void;
  onToggleImportant(sectionId: number, item: ItemWire): void;
  onToggleFeed(feed: FeedWire): void;
  onToggleMute(feed: FeedWire): void;
  onUpdateInterval(feed: FeedWire, minutes: number | null): void;
  onRemoveFeed(feed: FeedWire): void;
};

function fmtTime(value?: string | null) {
  if (!value) return 'Never fetched';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Never fetched' : date.toLocaleString();
}

function sectionStyle(appearance?: SectionAppearanceWire): React.CSSProperties {
  if (!appearance) return {};
  if (appearance.mode === 'image' && appearance.imageDataUrl) {
    return { backgroundImage: `linear-gradient(rgba(15, 18, 24, 0.82), rgba(15, 18, 24, 0.82)), url(${appearance.imageDataUrl})` };
  }
  if (appearance.mode === 'gradient') {
    return { backgroundImage: `linear-gradient(135deg, ${appearance.gradientFrom || '#243447'}, ${appearance.gradientTo || '#14532d'})` };
  }
  return { background: appearance.solid || '#161b22' };
}

export function SectionPanel(props: SectionPanelProps) {
  const feedCount = props.section.feeds.length;
  const activeCount = props.section.feeds.filter((feed) => feed.is_enabled === 1 && feed.is_muted !== 1).length;

  return (
    <section className="section" style={sectionStyle(props.appearance)} data-section-key={props.section.key} aria-labelledby={`section-${props.section.key}`}>
      <header className="section-header">
        <div>
          <h2 id={`section-${props.section.key}`}>{props.section.name}</h2>
          <p>{feedCount === 0 ? 'No feeds yet' : `${activeCount}/${feedCount} feeds active`}</p>
        </div>
        <div className="section-actions">
          <button type="button" onClick={() => props.onRefresh(props.section.id)} disabled={feedCount === 0 || props.loading}>Refresh</button>
          <button type="button" onClick={() => props.onMarkSeen(props.section.id)} disabled={props.items.length === 0}>Mark read</button>
        </div>
      </header>

      {props.progress !== undefined ? (
        <div className="sync-progress" aria-live="polite">
          <progress value={props.progress} max="100" aria-label={`${props.section.name} refresh progress`} />
          <span>{props.progress}%</span>
        </div>
      ) : null}

      <div className="feed-strip" aria-label={`${props.section.name} feeds`}>
        {props.section.feeds.length === 0 ? (
          <div className="feed-empty">Add an RSS or Atom URL to start this section.</div>
        ) : props.section.feeds.map((feed) => (
          <div key={feed.id} className={feed.is_enabled && !feed.is_muted ? 'feed-chip' : 'feed-chip disabled'}>
            <div className="feed-chip-main">
              <strong>{feed.title || new URL(feed.url).hostname}</strong>
              <span>{feed.item_count} items - {feed.unread_count} unread - {fmtTime(feed.last_fetched_at)}</span>
              <span>{feed.is_muted ? 'Muted' : feed.is_enabled ? 'Enabled' : 'Disabled'} - every {feed.fetch_interval_minutes || 30} minutes</span>
              {feed.last_error ? <em>{feed.last_error}</em> : null}
            </div>
            <div className="feed-chip-actions">
              <label className="compact-field">
                <span>Minutes</span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  defaultValue={feed.fetch_interval_minutes || 30}
                  onBlur={(event) => props.onUpdateInterval(feed, Number(event.currentTarget.value) || null)}
                />
              </label>
              <button type="button" onClick={() => props.onToggleMute(feed)}>{feed.is_muted ? 'Unmute' : 'Mute'}</button>
              <button type="button" onClick={() => props.onToggleFeed(feed)}>{feed.is_enabled ? 'Disable' : 'Enable'}</button>
              <button type="button" onClick={() => props.onRemoveFeed(feed)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-feed-window">
        {props.loading ? <div className="state-card" role="status">Loading latest items...</div> : null}
        {!props.loading && props.error ? <div className="state-card error" role="alert">{props.error}</div> : null}
        {!props.loading && !props.error ? (
          <ItemList
            sectionId={props.section.id}
            items={props.items}
            openExternalItem={props.openExternalItem}
            onToggleImportant={props.onToggleImportant}
          />
        ) : null}
      </div>
    </section>
  );
}