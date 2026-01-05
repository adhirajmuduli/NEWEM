
(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Components = (window as any).READIT.Components || {};

  function fmtTime(iso?: string | null): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return "";
    }
  }

  function ItemList(props: { items: READIT.ItemWire[] }): any {
    return React.createElement(
      "div",
      { className: "item-list" },
      (props.items || []).map((it) =>
        React.createElement(
          "div",
          { key: it.id, className: "item-row" },
          React.createElement(
            "div",
            { className: "item-head" },
            React.createElement(
              "a",
              { href: it.link ?? "#", target: "_blank", rel: "noreferrer noopener" },
              it.title ?? "(untitled)"
            ),
            React.createElement(
              "span",
              { className: "item-meta" },
              `${it.feed_title ?? ""} · ${fmtTime(it.published_at)}`
            )
          ),
          it.description
            ? React.createElement("div", { className: "item-desc" }, it.description)
            : null
        )
      )
    );
  }

  (window as any).READIT.Components.ItemList = ItemList;
})();