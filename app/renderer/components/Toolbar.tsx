/* global React */

(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Components = (window as any).READIT.Components || {};

  function Toolbar(): any {
    return React.createElement(
      "div",
      { className: "toolbar" },
      React.createElement("h1", null, "READIT"),
      React.createElement("button", { type: "button" }, "Refresh")
    );
  }

  (window as any).READIT.Components.Toolbar = Toolbar;
})();