# Local RSS News Aggregator (Electron + Node.js + SQLite)

## Purpose
A local-only desktop RSS reader for personal, non-commercial use. It fetches RSS feeds on a schedule, stores headlines and short descriptions locally, deduplicates items, and opens full articles in the user’s default browser. No backend server or third-party APIs are used—only RSS feeds.

This application functions as a local RSS reader and does not operate as a news aggregation service.

## Core Principles and Constraints
- **RSS feeds only.** No scraping, no custom APIs.
- **Local-only data and processing.** No cloud or external backend.
- **Headlines + short descriptions + source link only.**
- **Full articles open in the external browser.**
- **Configurable sections** (e.g., World, India, Tech).
- **Resizable and rearrangeable layout.**
- **Periodic fetching with caching and deduplication.**
- **Personal, non-commercial usage.**

## Architecture
See also Development Plan for implementation order.

- **Main Concepts**
  - Electron Main Process: App lifecycle, window creation, secure IPC, scheduling fetch jobs.
  - Renderer Process: UI, layout, sections, item lists. No direct Node access.
  - Preload (Context Bridge): Narrow, explicit API surface from Main to Renderer.
  - Core Modules (Node): RSS fetching, parsing, caching, deduplication, and storage DAO.
  - SQLite: Persistent local data store.

- **Technology Choices: Electron + SQLite**
  - Electron is used for flexible layout and cross-platform UI; SQLite is used for simple, reliable local persistence without external services.

- **Process Boundaries and IPC**
  - Main owns filesystem, networking, and DB access.
  - Renderer requests via IPC routes exposed by Preload (e.g., `feeds:list`, `feeds:add`, `items:query`, `settings:get/set`, `sync:trigger`).
  - Preload enforces type-checked request/response contracts and sanitizes inputs.
  - Renderer never holds long-lived copies of items; all queries are paginated and time-bounded.
  - IPC routes (indicative):
    - `feeds:list` (paginated), `feeds:bulkAdd(text)` to accept newline-separated URLs, `feeds:remove(id)`, `feeds:enable(id,bool)`.
    - `sections:list`, `sections:assign(feedId, sectionId)`, `sections:reorder([...ids])`.
    - `items:query({ sectionId?, includeSeen=false, limit, before? })` returns time-bounded, paginated items.
    - `items:markSeen({ itemIds })` and `items:markSectionSeen(sectionId)`.
    - `settings:get(key?)`, `settings:set({ key, value })` for `show_seen_news`, `theme_mode`, `layout`.
    - `sync:trigger({ feedId? })` to kick off an immediate fetch.

- **Modules**
  - RSS Fetcher: Periodically pulls feeds, uses HTTP caching (ETag/Last-Modified), respects feed `ttl` when present, controls concurrency, and backs off on errors.
  - Parser: Parses RSS/Atom, extracts title, link, description/summary, published date, GUID, and source metadata. Sanitizes HTML.
  - Deduplicator: Generates stable identity keys using GUID if present, else normalized link and a title-hash. Prevents duplicates across fetches and across feeds.
  - Storage (DAO): Typed accessors for feeds, sections, items, and settings. Manages indices, migrations, and transactions.
  - Scheduler: Central job loop (e.g., every 15–30 minutes) with per-feed cadence and jitter; resumes on app start.
  - Seen State Management: Items can be marked seen (e.g., when opened or via a bulk "mark visible seen"); queries hide seen items unless `show_seen_news` is enabled.

- **Fetching, Caching, Backoff, and Intervals**
  - Defaults: `default_fetch_interval = 30 minutes`; `min_allowed_interval = 10 minutes` (reject or clamp smaller values).
  - Cache keys per feed with persisted `etag`, `last_modified`, and `last_fetched`.
  - On 304 or unchanged content, skip parsing/storage.
  - On errors, exponential backoff per feed and capture `last_error`.
  - Honor `ttl`/`sy:updatePeriod` if provided; otherwise default schedule.

- **UI/UX**
  - Layout System: Grid-based panels that are resizable by dragging (no code changes required to adjust sizes). Drag-and-drop to rearrange sections; sizes and positions persist.
  - Sections: User-defined groups (e.g., India, World, Tech, Business). Each panel is independently scrollable and shows merged, deduped items from assigned feeds.
  - Item Row Layout: Table-like row with no margins, columns in order: `NEWS AGENCY | HEADLINE | TIME | BRIEF (if present)`.
  - Feed Management UI: Paste newline-separated RSS URLs in a text area to add feeds; immediately lists all active feed URLs; supports enable/disable and removal; validates URLs.
  - Seen Items: Previously seen items are cached locally but hidden by default. A setting "show seen news" reveals them when enabled.
  - Theming: Two modes with CSS variables. Light uses off-white/cream tones; Dark uses deep maroon/dark-blue variants (different section accents). Theme choice is persisted.

- **Security**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - Strict CSP in renderer.
  - Preload exposes minimal, validated IPC API.
  - Sanitize and strip unsafe HTML in descriptions; no remote code/content execution.

- **Error Handling & Observability**
  - Structured logging (level, module, correlation id).
  - In-app diagnostics view (optional), and file-based logs.
  - Recoverable migrations and integrity checks on startup.

- **Packaging**
  - Single desktop app bundle (no server). Electron builder for distribution.
  - Cross-platform: Windows first; macOS/Linux planned.

## Data Model
- **Tables**
  - feeds
    - id (PK)
    - url (unique)
    - title
    - site_url
    - etag
    - last_modified
    - last_fetched_at
    - fetch_interval_minutes
    - last_error
    - is_enabled
    - created_at, updated_at
    - Index: url unique, is_enabled

  - sections
    - id (PK)
    - name (unique)
    - position_index
    - created_at, updated_at
    - Index: name unique, position_index

  - feed_sections (many-to-many)
    - feed_id (FK feeds.id)
    - section_id (FK sections.id)
    - PK (feed_id, section_id)

  - items
    - id (PK)
    - feed_id (FK feeds.id)
    - guid
    - link
    - title
    - description
    - published_at
    - dedupe_key (unique)  // computed from guid or normalized link+title hash
    - seen_at (nullable timestamp)
    - created_at
    - Index: dedupe_key unique, published_at, feed_id

  - settings
    - key (PK)
    - value_json
    - Expected keys: `show_seen_news` (boolean), `theme_mode` ("light"|"dark"), `layout` (panel sizes/positions), optional `section_colors`.

  - fetch_log (optional for diagnostics)
    - id (PK)
    - feed_id
    - status
    - http_status
    - fetched_at
    - duration_ms
    - message

- **Deduplication**
  - Prefer GUID if stable.
  - Fallback: canonicalized link (strip tracking params, trailing slashes) + normalized title (case-folding, whitespace) → SHA-1/256 hash as `dedupe_key`.

- **Retention**
  - Optional setting to keep only N most recent items per feed/section.

## Directory Structure
This structure is the target for Step 1 in Development Plan.

```
/app
  /main
    app.ts
    windows.ts
    ipc.ts
    scheduler.ts
    logging.ts
  /preload
    bridge.ts
    validators.ts
    types.ts
  /core
    rss
      fetcher.ts
      parser.ts
      dedupe.ts
      cache.ts
    storage
      db.ts
      migrations/
        001_init.sql
        002_indexes.sql
      dao/
        feedsDao.ts
        sectionsDao.ts
        itemsDao.ts
        settingsDao.ts
  /renderer
    index.html
    index.tsx
    /components
      AppShell.tsx
      SectionPanel.tsx
      ItemList.tsx
      Toolbar.tsx
      SettingsDialog.tsx
    /layout
      GridLayout.tsx
      DragHandle.tsx
    /state
      store.ts
      queries.ts
    /styles
      app.css
  /assets
    icon.png
/scripts
  dev.ts
  build.ts
/config
  csp.json
  app.config.json
README.md
package.json
tsconfig.json
```

## Development Plan (Phased)
Each step references the relevant README sections you should consult while implementing.

1) **Directory Structure**
- Deliverable: Scaffold directories and baseline files exactly as in Directory Structure.
- Reference: Directory Structure; Architecture (Processes and IPC); Security; Technology Choices.

2) **Core Modules (RSS Fetcher, Storage)**
- Deliverable: Implement `/core/storage` (db, migrations, DAO) and `/core/rss` (fetcher, parser, dedupe, cache) with unit tests.
- Reference: Architecture (Modules; Fetching/Caching/Backoff/Intervals; Deduplication); Data Model; Error Handling.

3) **UI Shell**
- Deliverable: Electron window, Preload bridge, minimal renderer with app shell and basic item list.
- Reference: Architecture (Process Boundaries and IPC; Security); UI/UX (Item Row Layout; Theming baseline); Purpose.

4) **Layout System**
- Deliverable: Resizable, rearrangeable grid; persistence of panel positions; drag-and-drop.
- Reference: Architecture (UI/UX); Settings (layout persistence in `settings` table).

5) **Settings and Feed Management**
- Deliverable: UI to paste newline-separated feed URLs (bulk add), list/remove/enable feeds, assign to sections, configure intervals, toggle "show seen news", toggle theme, and save layout preferences.
- Reference: Data Model (feeds, sections, feed_sections, settings incl. `show_seen_news` and `theme_mode`); Architecture (IPC routes; Scheduler with default/min intervals; Seen State Management); Security.

## How It Works (Data Flow)
- On schedule, Scheduler invokes RSS Fetcher per feed with caching headers.
- Parser extracts items; Deduplicator computes `dedupe_key`.
- DAO inserts new items and updates feed metadata and caching markers.
- Renderer queries items by section (paginated and time-bounded); user clicks open link in external browser.
- Items are marked seen when opened (and optionally via a "mark visible as seen" action). By default, queries exclude seen items unless the "show seen news" setting is enabled.
- Settings change IPC calls update DB and affect Scheduler behavior.

## Legal and Usage Disclaimer
- For personal, non-commercial use only.
- The app fetches publicly available RSS feeds and stores limited metadata locally.
- It does not scrape websites or bypass access controls.
- Respect each site’s terms of service and robots policies for feed endpoints.
- Content remains the property of the original publishers; this app displays summaries and links only.
- No redistribution or republishing of full content. Full articles open in your browser on the publisher’s site.
- No tracking or analytics are included; your data stays local.

This application functions as a local RSS reader and does not operate as a news aggregation service.

## Non-Goals
- No backend servers, cloud sync, or user accounts.
- No scraping of web pages or bypassing paywalls.
- No full-article in-app reader or ad blocking.
- No ML ranking/recommendations.
- No social sharing or read-it-later service integration (initial scope).
- No push notifications (initial scope).

## Future Enhancements (Optional)
- Import/export OPML.
- Multi-window support.
- Custom filters/muting rules.
- Offline-first view with retention controls.
- Theming and accessibility refinements.


