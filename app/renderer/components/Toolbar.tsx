import React from 'react';

export function Toolbar(props: {
  busy: boolean;
  onRefreshAll(): void;
  onOpenManager(): void;
}) {
  return (
    <div className="toolbar">
      <div>
        <h1>READIT</h1>
        <span>Local RSS workspace</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={props.onOpenManager}>Manage</button>
        <button type="button" className="primary" onClick={props.onRefreshAll} disabled={props.busy}>
          {props.busy ? 'Refreshing...' : 'Refresh all'}
        </button>
      </div>
    </div>
  );
}
