/* global React */

(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Components = (window as any).READIT.Components || {};

  function AppShell(): any {
    const C = (window as any).READIT.Components;

    return React.createElement(
      "div",
      { className: "app-shell" },
      React.createElement(C.Toolbar),
      React.createElement(
        "div",
        { className: "sections" },
        React.createElement(C.SectionPanel, { sectionId: -1, title: "Important" }),
        React.createElement(C.SectionPanel, { sectionId: 1, title: "Tech" }),
        React.createElement(C.SectionPanel, { sectionId: 2, title: "World" }),
        React.createElement(C.SectionPanel, { sectionId: 3, title: "Sports" })
      )
    );
  }

  (window as any).READIT.Components.AppShell = AppShell;
})();