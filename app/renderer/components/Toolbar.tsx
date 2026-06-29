import React from 'react';
import { RefreshCwIcon, SettingsIcon } from 'lucide-react';
import { SearchControls, type SearchControlsProps } from './SearchControls';
import { DigitalButton } from './ui/digital-button';

export function Toolbar(props: {
  busy: boolean;
  search: SearchControlsProps;
  onRefreshAll(): void;
  onOpenManager(): void;
}) {
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <h1>READIT</h1>
        <span>Local RSS workspace</span>
      </div>
      <SearchControls {...props.search} />
      <div className="toolbar-actions">
        <DigitalButton effect="neon" type="button" onClick={props.onOpenManager} title="Manage sections, feeds, layout, and appearance">
          <SettingsIcon aria-hidden="true" />
          <span>Manage</span>
        </DigitalButton>
        <DigitalButton effect="beam" type="button" className="primary" onClick={props.onRefreshAll} disabled={props.busy} title="Refresh all feeds">
          <RefreshCwIcon aria-hidden="true" />
          <span>{props.busy ? 'Refreshing...' : 'Refresh all'}</span>
        </DigitalButton>
      </div>
    </header>
  );
}