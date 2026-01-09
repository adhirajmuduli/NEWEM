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

  function ItemList(props: { sectionId: number; items: READIT.ItemWire[] }): any {
    const sanitize = (window as any).READIT?.Utils?.sanitizeHtml || ((s: string) => s);
    const Store = (window as any).READIT?.Store;

    return React.createElement(
      "div",
      { className: "item-list" },
      (props.items || []).map((it) =>
        React.createElement(
          "div",
          { key: it.id, className: "item-card" },
          React.createElement(
            "div",
            { className: "item-row" },
            React.createElement(
                "div",
                { className: "item-head" },
                React.createElement(
                "a",
                {
                    href: it.link ?? "#",
                    target: "_blank",
                    rel: "noreferrer noopener",
                    onClick: () => Store && Store.markItemRead(props.sectionId, it.id),
                },
                it.title ?? "(untitled)"
                ),
                React.createElement(
                    "button",
                    {
                        type: "button",
                        className: it.is_important ? "star active" : "star",
                        onClick: (e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        Store && Store.toggleItemImportant(props.sectionId, it.id);
                        },
                        title: "Note later",
                    },
                    "★"
                ),

                React.createElement(
                "span",
                { className: "item-meta" },
                `${it.feed_title ?? ""} · ${fmtTime(it.published_at)}`
                )
            )
          ),
          it.description
            ? React.createElement("div", {
                className: "item-desc",
                dangerouslySetInnerHTML: { __html: sanitize(it.description) },
              })
            : null
        )
      )
    );
  }

  (window as any).READIT.Components.ItemList = ItemList;
})();