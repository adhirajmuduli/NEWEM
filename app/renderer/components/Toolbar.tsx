import React from 'react';
import { RefreshCwIcon, SettingsIcon, XIcon } from 'lucide-react';
import { SearchControls, type SearchControlsProps } from './SearchControls';
import { HELP_TEXT } from '../helpText';

export function Toolbar(props: {
  busy: boolean;
  search: SearchControlsProps;
  onRefreshAll(): void;
  onOpenManager(): void;
  onExitApplication(): void;
}) {
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <h1>READIT</h1>
        <span>Local RSS workspace</span>
      </div>
      <SearchControls {...props.search} />
      <div className="toolbar-actions">
        <button type="button" onClick={props.onOpenManager} title={HELP_TEXT.manage}>
          <SettingsIcon aria-hidden="true" />
          <span>Manage</span>
        </button>
        <button type="button" className="primary" onClick={props.onRefreshAll} disabled={props.busy} title={HELP_TEXT.refreshAll}>
          <RefreshCwIcon aria-hidden="true" />
          <span>{props.busy ? 'Refreshing...' : 'Refresh all'}</span>
        </button>
        <button type="button" className="exit-application" onClick={props.onExitApplication} title={HELP_TEXT.exitApplication} aria-label={HELP_TEXT.exitApplication}>
          <XIcon aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
