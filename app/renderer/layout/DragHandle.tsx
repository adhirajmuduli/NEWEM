import React from 'react';

export function ResizeHandle(props: {
  label: string;
  onResizeStart(clientX: number): void;
}) {
  return (
    <button
      type="button"
      className="resize-handle"
      aria-label={props.label}
      title={props.label}
      onPointerDown={(event) => {
        event.preventDefault();
        props.onResizeStart(event.clientX);
      }}
    />
  );
}