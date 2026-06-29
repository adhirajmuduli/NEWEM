import React from 'react';
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { contrastText, mixColors } from '../../shared/colorSchemes';
import type { FeedWire, ItemWire, SectionAppearanceWire, SectionWire } from '../../shared/ipcTypes';
import { ItemList } from './ItemList';
import { DigitalButton } from './ui/digital-button';
import { ProgressiveBlur } from './ui/progressive-blur';

type SectionPanelProps = {
  section: SectionWire;
  items: ItemWire[];
  loading: boolean;
  error: string | null;
  warning: string | null;
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

type SectionStyle = React.CSSProperties & Record<`--${string}`, string>;

function fmtTime(value?: string | null) {
  if (!value) return 'Never fetched';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Never fetched' : date.toLocaleString();
}

function textVariables(background: string): SectionStyle {
  const text = contrastText(background);
  return {
    '--text': text,
    '--muted': mixColors(background, text, 0.68),
    '--card-text': text,
    '--card-muted': mixColors(background, text, 0.7),
  };
}

function sectionStyle(appearance?: SectionAppearanceWire): SectionStyle {
  if (!appearance) return {};
  if (appearance.mode === 'image' && appearance.imageDataUrl) {
    return {
      backgroundImage: `linear-gradient(rgba(8, 12, 18, 0.58), rgba(8, 12, 18, 0.68)), url(${appearance.imageDataUrl})`,
      '--text': '#ffffff',
      '--muted': '#d1d5db',
      '--card-text': '#ffffff',
      '--card-muted': '#d1d5db',
    };
  }
  if (appearance.mode === 'gradient') {
    const from = appearance.gradientFrom || '#243447';
    const to = appearance.gradientTo || '#14532d';
    return {
      backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
      ...textVariables(mixColors(from, to, 0.5)),
    };
  }
  const solid = appearance.solid || '#161b22';
  return { background: solid, ...textVariables(solid) };
}

export function SectionPanel(props: SectionPanelProps) {
  const [sourcesOpen, setSourcesOpen] = React.useState(true);
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
          <DigitalButton effect="beam" type="button" onClick={() => props.onRefresh(props.section.id)} disabled={feedCount === 0 || props.loading}>Refresh</DigitalButton>
          <DigitalButton effect="shiny" type="button" onClick={() => props.onMarkSeen(props.section.id)} disabled={props.items.length === 0}>Mark read</DigitalButton>
        </div>
      </header>

      {props.progress !== undefined ? (
        <div className="sync-progress" aria-live="polite">
          <progress value={props.progress} max="100" aria-label={`${props.section.name} refresh progress`} />
          <span>{props.progress}%</span>
        </div>
      ) : null}

      <div className="section-content">
        <aside className={sourcesOpen ? 'feed-source-rail open' : 'feed-source-rail collapsed'} aria-label={`${props.section.name} feed sources`}>
          <header className="source-rail-header">
            {sourcesOpen ? <h3>Sources</h3> : null}
            <button
              type="button"
              className="source-rail-toggle"
              onClick={() => setSourcesOpen((open) => !open)}
              aria-expanded={sourcesOpen}
              aria-label={sourcesOpen ? 'Collapse feed sources' : 'Expand feed sources'}
              title={sourcesOpen ? 'Collapse feed sources' : 'Expand feed sources'}
            >
              {sourcesOpen ? <PanelLeftCloseIcon aria-hidden="true" /> : <PanelLeftOpenIcon aria-hidden="true" />}
            </button>
          </header>
          {sourcesOpen ? (
            <>
              <div className="feed-strip" aria-label={`${props.section.name} feeds`}>
                {props.section.feeds.length === 0 ? (
                  <div className="feed-empty">Add an RSS or Atom URL to start this section.</div>
                ) : props.section.feeds.map((feed) => (
                  <div key={feed.id} className={feed.is_enabled && !feed.is_muted ? 'feed-chip' : 'feed-chip disabled'}>
                    <div className="feed-chip-main">
                      <strong>{feed.title || new URL(feed.url).hostname}</strong>
                      <span>{feed.item_count} items - {feed.unread_count} unread</span>
                      <span>{fmtTime(feed.last_fetched_at)}</span>
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
              <ProgressiveBlur className="rail-progressive-blur" height="12%" position="bottom" blurLevels={[0.5, 1, 2, 4]} />
            </>
          ) : null}
        </aside>

        <div className="section-feed-window">
          <div className="section-feed-scroll">
            {props.loading ? <div className="state-card" role="status">Loading latest items...</div> : null}
            {!props.loading && props.error ? <div className="state-card error" role="alert">{props.error}</div> : null}
            {!props.loading && !props.error && props.warning ? <div className="state-card warning" role="status">{props.warning}</div> : null}
            {!props.loading && !props.error ? (
              <ItemList
                sectionId={props.section.id}
                items={props.items}
                openExternalItem={props.openExternalItem}
                onToggleImportant={props.onToggleImportant}
              />
            ) : null}
          </div>
          <ProgressiveBlur className="news-progressive-blur" height="10%" position="bottom" blurLevels={[0.5, 1, 2, 4]} />
        </div>
      </div>
    </section>
  );
}