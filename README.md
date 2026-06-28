# READIT

> A local-first, user-configurable RSS and Atom desktop reader built with Electron, React, TypeScript, Vite, and SQLite.

READIT turns multiple feeds into a persistent, section-oriented reading workspace. Users manage sections and subscriptions in the app, arrange and resize panels, search local content, preserve read/important state, and export their data without giving the renderer direct access to Node.js, SQLite, or the filesystem.

## Project Status

READIT is an active pre-release application, not a packaged production release. The main product path is implemented and covered by automated validation:

- Dynamic section creation, rename, reorder, deletion, and a versioned production catalog
- 14 catalog sections, 110 unique RSS/Atom feeds, and 158 intentional section mappings
- RSS/Atom validation, website feed autodiscovery, assignment, mute, disable, and interval controls
- Safe conditional synchronization with ETag and Last-Modified
- Local search plus unread, important, source, and date filters
- Stack, columns, mosaic, and focus layouts with persistent widths and order
- Per-section solid, gradient, or imported local-image appearance
- OPML import/export, SQLite backup, and structured diagnostics export
- Sandboxed Electron renderer with strict CSP and validated preload IPC

Release engineering remains separate: there is no installer, updater, signing, or platform packaging configuration yet. See [Current Boundaries](#current-boundaries).

## Why READIT

Most feed readers impose a fixed navigation model or move subscriptions and reading history into a hosted service. READIT is intended for users who want:

- A local database they control
- A workspace organized by their own topics
- Multiple simultaneously visible reading panels
- Repeatable RSS ingestion with observable failure state
- Explicit trust boundaries between web content and privileged desktop APIs
- Portable subscriptions and recoverable local data

The application accepts RSS and Atom feeds only. JSON news APIs and JSON Feed are outside the current contract.

## Quick Start

### Requirements

- Windows 10/11, macOS, or Linux capable of running Electron 42
- A compatible Node.js release and npm
- A C/C++ toolchain only if a prebuilt better-sqlite3 binary is unavailable

### Install

~~~powershell
git clone <repository-url>
cd NEWSFEED
npm install
~~~

Installation prepares two native SQLite binaries: the standard Node ABI binding used by Vitest and a separate Electron 42 binding used by the desktop process. To regenerate both bindings:

~~~powershell
npm run rebuild:native
~~~

### Build and Run

~~~powershell
npm run build
npm start
~~~

For a one-command local build and launch:

~~~powershell
npm run dev
~~~

**npm run build** performs a safe dist cleanup, TypeScript checks, Electron compilation, the Vite renderer build, and static asset/migration copying. **npm start** launches the already-built application.

### Validate

~~~powershell
npm run validate
~~~

This is the required merge gate. It runs the production build and every Vitest suite.

## User Guide

### Sections

1. Open **Manage**.
2. Enter a section name and select **Create**.
3. Select a section to rename, move, or delete it.
4. A section with mapped feeds requires confirmation before deletion.
5. Stable section keys preserve panel layout when a section is renamed.

Catalog version 1 is applied transactionally once per database from **app/config/sections.ts**. It adds 14 sections, 110 unique feeds, and 158 mappings without deleting user data. Legacy **Tech** and **Bhubaneswar** defaults are reused as **Technology** and **Odisha**, preserving their stable layout keys. The four auxiliary feed groups are combined under **Other Important Buckets**.

### Add a Feed or Website

1. Select a section in **Manage**.
2. Enter an absolute public HTTP(S) URL.
3. Select **Test feed**.
4. Direct RSS/Atom documents are validated immediately.
5. HTML pages are inspected for RSS/Atom alternate links; discovered candidates are validated.
6. Set the fetch interval and select **Add feed**.

Localhost, private literal IPs, file URLs, and custom protocols are rejected. Redirects are bounded and every redirect target is revalidated.

### Read and Refresh

- **Refresh all** synchronizes every enabled, unmuted feed.
- Background synchronization starts after the UI and is capped at four concurrent network requests.
- A section **Refresh** synchronizes only that section.
- Progress is reported per section or globally.
- Opening an article marks it read and delegates the URL to the operating-system browser.
- Important state is independent of read state.
- Feed cards show fetch time, item/unread counts, errors, interval, enabled state, and mute state.

### Search and Filter

The search surface queries SQLite, not the network:

- Case-insensitive text match across title, description, and feed title
- Unread-only and important-only modes
- Source-feed filter
- Past day, week, or month filter
- Global scope across locally stored items
- Maximum 200 results per request

### Layout and Appearance

- **Stack** is the default single-column layout.
- **Columns**, **Mosaic**, and **Focus** provide multi-panel workspaces.
- Drag a resize handle to change a panel width.
- Move controls reorder stable panel keys.
- **Reset layout** rebuilds a valid layout for current sections.
- Small viewports collapse to a vertical, non-overflowing fallback.
- Backgrounds support a solid color, two-color gradient, or imported PNG/JPEG/WebP/GIF data URL up to 1.5 MB.

### Portability and Recovery

The management panel provides:

- **Export OPML**: section-grouped RSS/Atom subscriptions.
- **Import OPML**: imports up to 5 MB and skips invalid or duplicate mappings.
- **Back up database**: creates a consistent SQLite backup in **data/exports/**.
- **Export diagnostics**: writes runtime metadata, migration history, counts, recent fetch records, and bounded structured logs to **data/exports/**.

Diagnostics exclude article bodies. Review an export before sharing because feed URLs and error messages can be sensitive.

## Architecture

~~~text
Renderer (React, untrusted)
        |
        | window.readit: versioned narrow preload API
        v
Preload (contextBridge)
        |
        | validated invoke calls and sync progress event
        v
Main process (IPC, navigation, exports, scheduler)
        |
        +---- RSS pipeline (validate -> fetch -> parse -> dedupe -> transaction)
        |
        +---- Storage services and DAOs
                     |
                     v
               SQLite app.db
~~~

### Process Responsibilities

| Layer | Responsibilities | Explicitly forbidden |
| --- | --- | --- |
| Renderer | UI state, layouts, search, sanitized previews | Electron, Node.js, filesystem, SQLite, direct external navigation |
| Preload | Expose the typed window.readit capability set | General-purpose IPC and arbitrary channels |
| Main | Runtime validation, privileged actions, navigation, scheduling, exports | Trusting renderer IDs, URLs, limits, timestamps, or unknown fields |
| Core | Feed safety, parsing, deduplication, synchronization, migrations, DAOs | Renderer dependencies |
| SQLite | Durable feeds, mappings, items, state, settings, logs | Network access |

## RSS Synchronization Contract

The canonical pipeline is **app/core/rss/sync.ts**.

1. Normalize and validate the URL.
2. Load persisted ETag and Last-Modified validators.
3. Fetch with a 15-second default timeout, five-redirect limit, and 2 MB body cap.
4. Revalidate every redirect URL.
5. Handle 304 without parsing.
6. Parse RSS/Atom XML with the shared parser.
7. Generate the shared stable deduplication key.
8. Persist metadata, items, cache headers, and fetch logs in coherent transactions.
9. Return deterministic requested, triggered, successful, unchanged, failed, and inserted counts.

Fetch errors are structured: timeout, redirect limit, response-size limit, HTTP, network, and URL validation failures. Parse and feed-state errors are separate.

## Data Contract

SQLite is initialized under **data/app.db** when READIT runs from the repository root.

### Core Tables

| Table | Purpose |
| --- | --- |
| sections | Stable key, display name, and position |
| feeds | URL, metadata, cache headers, lifecycle, interval, enabled/muted state |
| feed_sections | Many-to-many feed/section mappings |
| items | Feed items and stable deduplication key |
| item_state | Canonical read and important state |
| settings | JSON layout and UI preferences |
| fetch_log | Structured synchronization outcomes |
| schema_migrations | Append-only migration ledger |

**item_state.is_read** and **item_state.is_important** are canonical. **items.seen_at** and optional legacy **feeds.fetch_error** are migration inputs only. **feeds.last_error** is the current error field.

### Migration Policy

- Ordered NNN_name.sql files are discovered automatically.
- Applied filenames are recorded in schema_migrations.
- Migrations are append-only and transactional.
- ensureStorageContract repairs specific legacy column contracts after migrations.
- Tests use temporary directories and never open data/app.db.
- 010_seed_sections_and_feeds.sql is a no-op compatibility migration; defaults come from application configuration.

## IPC Contract

The source of truth is **app/shared/ipcTypes.ts**. The renderer receives only **window.readit**.

Capability groups:

- Sections: list, create, update, delete, reorder
- Feeds: add, update, remove, test/discover
- Items: query, mark read/seen, toggle important
- Sync: feed/section/all triggers and bounded progress events
- Layout: get and set normalized layouts
- Portability: OPML import/export and database backup
- Diagnostics: local diagnostic export
- Navigation: allowlisted external HTTP(S) opening

Invoke payloads are checked for type, range, length, protocol, and unknown fields before handler logic. Pagination limits are clamped. The preload never exposes raw ipcRenderer.

## Security Model

### Electron Hardening

BrowserWindow uses:

~~~text
contextIsolation: true
nodeIntegration: false
sandbox: true
~~~

New windows are denied. Non-file navigation is prevented. Article URLs are opened by the main process through shell.openExternal.

### Content Security Policy

**config/csp.json** is loaded and enforced as a response header:

~~~text
default-src 'self'
script-src 'self'
style-src 'self'
connect-src 'self'
img-src 'self' data: https:
object-src 'none'
base-uri 'none'
frame-ancestors 'none'
~~~

React is bundled locally through Vite. The renderer has no CDN scripts or remote executable-code permission.

### Feed Content

Feed HTML is untrusted. Descriptions are sanitized before rendering, and article links cannot navigate the Electron window. URL checks reject unsupported protocols, credentials, localhost and .local names, private literal IPv4 ranges, and common local IPv6 ranges.

## Repository Structure

~~~text
NEWSFEED/
|-- app/
|   |-- config/                 First-run defaults
|   |-- core/
|   |   |-- rss/                URL safety, fetch, discovery, parse, dedupe, sync
|   |   +-- storage/
|   |       |-- dao/            Feed, section, item, and settings persistence
|   |       |-- migrations/     Ordered append-only SQLite migrations
|   |       |-- db.ts           Database lifecycle and migration discovery
|   |       +-- portability.ts  OPML import/export
|   |-- main/                   Bootstrap, IPC, scheduler, security, exports
|   |-- preload/                contextBridge implementation
|   |-- renderer/
|   |   |-- components/         Workspace, panels, toolbar, item views
|   |   |-- layout/             Layout normalization, ordering, resize logic
|   |   |-- styles/             Responsive styling
|   |   +-- utils/              Renderer sanitization
|   +-- shared/                 Versioned TypeScript IPC contracts
|-- config/                     CSP and application configuration
|-- scripts/                    Safe build, clean, copy, and utilities
|-- tests/
|   |-- unit/                   Fetch, discovery, and layout logic
|   |-- db/                     Migrations, DAOs, sync, search, portability, exports
|   |-- security/               CSP, window, IPC, links, sandbox smoke
|   |-- ui/                     React workflows with mocked preload
|   +-- e2e/                    User flow and restart persistence semantics
|-- vite.config.mts
|-- tsconfig.electron.json
|-- tsconfig.renderer.json
+-- package.json
~~~

**dist/** is generated and must not be edited. **node_modules/**, **assets/**, and **data/** are dependency/runtime artifacts rather than application source.

## Commands

| Command | Purpose |
| --- | --- |
| npm run typecheck | No-emit Electron/core and renderer checks |
| npm run build | Clean, typecheck, compile, bundle, copy assets |
| npm start | Launch the built Electron application |
| npm run dev | Build and launch locally |
| npm run rebuild:native | Prepare separate Node and Electron better-sqlite3 bindings |
| npm test | Run every Vitest suite |
| npm run test:unit | Fetch, discovery, parser, layout tests |
| npm run test:db | Temporary migration, DAO, sync, portability, export tests |
| npm run test:security | Window, CSP, IPC, link, sandbox tests |
| npm run test:e2e | User-flow and persisted-layout tests |
| npm run validate | Required full build and all tests |

## Development Rules

- Add schema changes as new ordered migrations; never rewrite a released migration.
- Keep renderer code free of Node.js, Electron, filesystem, and database imports.
- Add shared types and runtime validators together.
- Reject unknown IPC fields.
- Route feed URLs through the shared validator.
- Keep deduplication centralized.
- Use temporary databases in tests.
- Do not import application code from dist.
- Do not commit generated dist, runtime exports, or local databases.

## Current Boundaries

Before public release, the project still needs:

- Installer and platform packaging
- Code signing and release provenance
- Automatic updates
- OS-native user-data path migration instead of repository-relative data
- DNS-resolution-aware SSRF protection for hostnames resolving to private networks
- Full Playwright packaged-Electron tests; current e2e suites use Vitest/jsdom
- FTS5 indexing for substantially larger datasets
- Retention policies for items and fetch logs
- A crash-reporting and opt-in telemetry policy, if desired

These are explicit release boundaries, not hidden claims of completeness.

## Troubleshooting

### Native module ABI mismatch

The standard Node ABI 127 binding and Electron ABI 146 binding are stored separately. Regenerate and verify them before rebuilding:

~~~powershell
npm run rebuild:native
node scripts/verify-native.cjs
npm run build
npm start
~~~

The preparation script restores the Node binding in a finally block, including when Electron rebuilding fails.

### Blank or stale renderer

~~~powershell
npm run clean
npm run build
npm start
~~~

### Migration failure

Do not delete a production database first. Create a backup, inspect schema_migrations, and reproduce against a copied database. Automated tests never modify the live database.

### Feed fails validation

Confirm that the URL is public HTTP(S), returns RSS/Atom XML or advertises an RSS/Atom alternate, remains below the response limit, and does not redirect to a local/private address.

## License

See LICENSE.