import React from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { FeedWire } from '../../shared/ipcTypes';
import type { SearchDateMode } from '../utils/dateRange';
import { Calendar } from './ui/calendar';

export type SearchControlsProps = {
  query: string;
  unread: boolean;
  important: boolean;
  feedId: string;
  dateMode: SearchDateMode;
  customDate?: Date;
  feeds: FeedWire[];
  searching: boolean;
  onQueryChange(value: string): void;
  onUnreadChange(value: boolean): void;
  onImportantChange(value: boolean): void;
  onFeedChange(value: string): void;
  onDateModeChange(value: SearchDateMode): void;
  onCustomDateChange(value?: Date): void;
  onSearch(): void;
  onClear(): void;
};

export function SearchControls(props: SearchControlsProps) {
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const calendarContainer = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!calendarOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!calendarContainer.current?.contains(event.target as Node)) setCalendarOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCalendarOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [calendarOpen]);

  return (
    <section className="toolbar-search" aria-label="Search local articles">
      <label className="search-field">
        <span className="sr-only">Search articles</span>
        <input
          aria-label="Search articles"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') props.onSearch();
          }}
          placeholder="Title, summary, or source"
        />
      </label>

      <label>
        <span className="sr-only">Source</span>
        <select aria-label="Source" value={props.feedId} onChange={(event) => props.onFeedChange(event.target.value)}>
          <option value="">All feeds</option>
          {props.feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.title || feed.url}</option>)}
        </select>
      </label>

      <div className="date-filter" ref={calendarContainer}>
        <label>
          <span className="sr-only">Date</span>
          <select
            aria-label="Date"
            aria-expanded={calendarOpen}
            value={props.dateMode}
            onClick={() => {
              if (props.dateMode === 'custom') setCalendarOpen(true);
            }}
            onChange={(event) => {
              const mode = event.target.value as SearchDateMode;
              props.onDateModeChange(mode);
              setCalendarOpen(mode === 'custom');
            }}
          >
            <option value="">Any time</option>
            <option value="1">Past day</option>
            <option value="7">Past week</option>
            <option value="30">Past month</option>
            <option value="custom">{props.customDate ? format(props.customDate, 'PP') : 'Custom date'}</option>
          </select>
        </label>
        {props.dateMode === 'custom' && calendarOpen ? (
          <div className="calendar-popover" role="dialog" aria-label="Custom date calendar">
            <Calendar
              mode="single"
              selected={props.customDate}
              onSelect={(date) => {
                props.onCustomDateChange(date);
                if (date) setCalendarOpen(false);
              }}
              captionLayout="dropdown"
              startMonth={new Date(1990, 0)}
              endMonth={new Date()}
              showOutsideDays={false}
              disabled={{ after: new Date() }}
              autoFocus
            />
          </div>
        ) : null}
      </div>
      <label className="check-field"><input type="checkbox" checked={props.unread} onChange={(event) => props.onUnreadChange(event.target.checked)} /> Unread</label>
      <label className="check-field"><input type="checkbox" checked={props.important} onChange={(event) => props.onImportantChange(event.target.checked)} /> Important</label>
      <button type="button" className="primary search-command" onClick={props.onSearch} disabled={props.searching} title="Search local articles">
        <SearchIcon aria-hidden="true" />
        <span>{props.searching ? 'Searching...' : 'Search'}</span>
      </button>
      <button type="button" className="icon-command" onClick={props.onClear} title="Clear search" aria-label="Clear search">
        <XIcon aria-hidden="true" />
      </button>
    </section>
  );
}
