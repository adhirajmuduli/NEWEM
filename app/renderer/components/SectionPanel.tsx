/* global React */

(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Components = (window as any).READIT.Components || {};

  function SectionPanel(props: { sectionId: number; title: string }): any {
    const Store = (window as any).READIT.Store;
    const C = (window as any).READIT.Components;

    const [, setTick] = React.useState(0);

    React.useEffect(() => {
      Store.fetchItems(props.sectionId);
      return Store.subscribe(() => setTick((x: number) => x + 1));
    }, [props.sectionId]);

    const items = Store.getItems(props.sectionId);
    const loading = Store.isLoading(props.sectionId);
    const error = Store.getError(props.sectionId);

    return React.createElement(
      "div",
      { className: "section" },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        React.createElement("h2", { className: "title" }, props.title),
        React.createElement(
          "button",
          { type: "button", onClick: () => Store.markSectionSeen(props.sectionId) },
          "Mark section seen"
        )
      ),
      loading
        ? React.createElement("div", { className: "placeholder" }, "Loading…")
        : error
        ? React.createElement("div", { className: "placeholder" }, String(error))
        : React.createElement(C.ItemList, { items })
    );
  }

  (window as any).READIT.Components.SectionPanel = SectionPanel;
})();