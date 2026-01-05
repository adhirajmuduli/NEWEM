/* global React, ReactDOM */

declare const ReactDOM: any;

(function bootstrap() {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("root missing");

  const AppShell = (window as any).READIT?.Components?.AppShell;
  if (!AppShell) throw new Error("AppShell not found on window.READIT.Components");

  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(AppShell));
})();