# READIT

**A secure, local-first RSS and Atom desktop workspace.**

READIT turns public feeds into a configurable desktop reading environment. Users organize sources into persistent sections, refresh on demand or on a schedule, search locally stored articles, preserve important items, and customize responsive layouts without sending their reading database to a hosted service.

READIT is an Electron application built with React, TypeScript, Vite, SQLite, and better-sqlite3. The renderer is sandboxed and untrusted; all privileged work remains behind a narrow, validated preload API.

> Project status: pre-release. Source validation and unsigned cross-platform packaging are implemented. Public distribution still requires target-platform verification, signing, notarization, checksums, and release provenance.

## Why READIT

- **Local-first ownership:** feeds, articles, read state, layout, and preferences live in a local SQLite database.
- **Section-first reading:** a source may be mapped into one or more user-managed sections.
- **Deterministic ingestion:** one URL validator, parser, deduplication contract, synchronization pipeline, and migration ledger.
- **Desktop security:** no Node.js or Electron access in the renderer, strict CSP, validated IPC, bounded navigation, and main-process external links.
- **Portable subscriptions:** OPML import/export, database backup, and bounded diagnostics export.
- **Release-aware runtime:** immutable resources are separated from writable user data in packaged applications.

## Features

### Reading and organization

- Create, rename, reorder, and delete sections.
- Add direct RSS/Atom URLs or discover feeds advertised by a website.
- Enable, disable, mute, test, map, and remove feeds.
- Configure per-feed refresh intervals.
- Refresh a feed, section, or all enabled sources.
- Track section-level refresh progress and feed errors.
- Search locally across title, description, and source.
- Filter by unread state, important state, source, and date.
- Mark articles read or important independently.

### Workspace

- Stack and mosaic section layouts.
- Persisted section ordering, width, background, and article-age window.
- Solid, gradient, and imported raster backgrounds.
- Responsive small-window fallback.
- Internally scrolling source and article surfaces.

### Data portability

- Section-aware OPML export and import.
- Consistent SQLite backup.
- Structured diagnostics export with bounded logs and recent fetch outcomes.
- Append-only migrations with fresh-install and legacy-upgrade tests.

## Screenshots

Screenshots are not committed yet. Add verified desktop and small-window captures under **docs/screenshots/** before the first public release; do not use generated mockups as product evidence.

## System Requirements

| Component | Requirement |
| --- | --- |
| Node.js | 22.12 or newer; CI uses 22.17.0 |
| npm | Version bundled with the selected Node 22 release |
| Electron | 42.5.0 from the lockfile |
| Windows | Windows 10 or newer; PowerShell recommended |
| macOS | A version supported by Electron 42 |
| Linux | A modern x64 or arm64 desktop supported by Electron 42 |

better-sqlite3 is native code. A compiler toolchain may be required when a matching prebuilt binary is unavailable:

- Windows: Visual Studio Build Tools with Desktop development with C++ and Python.
- macOS: Xcode Command Line Tools.
- Linux: Python, make, GCC/G++, and target-package tooling.

## Install From Source

~~~text
git clone <repository-url>
cd NEWSFEED
npm ci
npm run rebuild:native
npm run validate
~~~

The postinstall hook prepares separate Node and Electron SQLite bindings. Run **npm run rebuild:native** again after changing Electron, Node architecture, or better-sqlite3.

## Development

~~~text
# Build and launch
npm run dev

# Build without launching
npm run build

# Launch the existing dist build
npm start

# Run all tests
npm test

# Required merge gate
npm run validate
~~~

The build sequence:

1. Safely clears generated dist output only.
2. Type-checks Electron/core, renderer, and tests.
3. Compiles the main/core TypeScript graph.
4. Bundles the sandboxed preload.
5. Bundles the React renderer with Vite.
6. Copies ordered SQLite migrations.

## Command Reference

| Command | Purpose |
| --- | --- |
| npm run typecheck | Strict no-emit checks for all TypeScript surfaces |
| npm run build | Reproducible production build under dist/ |
| npm start | Verify the native binding and launch the built app |
| npm run dev | Build and launch |
| npm test | Run all Vitest suites |
| npm run test:unit | Parser, URL, scheduler, layout, and utility tests |
| npm run test:db | Temporary migration, DAO, sync, and export tests |
| npm run test:security | CSP, IPC, navigation, window, and packaging tests |
| npm run test:e2e | React workflow and persistence semantics |
| npm run validate | Required build-and-test merge gate |
| npm run rebuild:native | Prepare separate Node and Electron SQLite bindings |
| npm run validate:icons | Validate platform icons and derive the Linux icon |
| npm run pack | Build an unpacked app for the current platform |
| npm run dist | Build current-platform installers/packages |
| npm run dist:win | Request Windows NSIS and portable artifacts |
| npm run dist:mac | Request macOS DMG and ZIP artifacts |
| npm run dist:linux | Request Linux AppImage and DEB artifacts |
| npm run dist:all | Best-effort cross-platform builder request |
| npm run verify:package | Inspect and launch-smoke the unpacked current-platform app |
| npm run validate:release | Validate, pack, inspect, and smoke-test the current platform |

## Packaging

electron-builder configuration lives in **electron-builder.yml**. Every packaging command runs the existing production build, prepares the Electron-native SQLite binding, validates icons, and then invokes electron-builder.

~~~text
# Unpacked current-platform app
npm run pack

# Current-platform distributables
npm run dist

# Structural and packaged SQLite smoke verification
npm run verify:package
~~~

Outputs are written under **release/** and use stable product/version/platform/architecture names.

### Windows

- NSIS assisted installer.
- Per-user installation by default.
- Changeable installation directory.
- Desktop and Start Menu shortcuts.
- Portable executable.
- Existing ICO resource.

### macOS

- DMG and ZIP.
- Existing ICNS resource.
- News application category.
- Hardened runtime enabled.
- Signing and notarization credentials are not embedded.

### Linux

- AppImage and DEB.
- News desktop category and package metadata.
- A deterministic 256x256 PNG is extracted from the existing valid ICO artwork.

Cross-platform compilation is not equivalent to a target-platform release. Native modules must be prepared for the target OS and architecture, and macOS signing must run on macOS. Use the GitHub Actions matrix or native release hosts.

See [Release Engineering](docs/release.md) for signing, notarization, CI, and the manual acceptance checklist.

## Release Workflow

~~~text
npm ci
npm run rebuild:native
npm run validate
npm run dist
npm run verify:package
~~~

For a public release:

1. Use a clean tagged checkout and locked install.
2. Run the merge gate.
3. Build on each target operating system.
4. Run packaged structure and SQLite smoke verification.
5. Perform the manual acceptance flow.
6. Sign Windows and macOS artifacts.
7. Notarize macOS artifacts.
8. Generate and publish checksums and provenance.
9. Upload immutable release artifacts.

The CI workflow builds and uploads unsigned artifacts. It deliberately does not create or publish a GitHub Release.

## Runtime Data Locations

READIT never bundles the development database into an installer.

| Mode | Mutable data | Immutable resources |
| --- | --- | --- |
| Development | repository data/app.db and data/exports/ | repository config/ and dist migrations |
| Tests | unique temporary directories | source migrations and explicit fixtures |
| Packaged | Electron app.getPath("userData") | process.resourcesPath |

Typical packaged user-data roots:

- Windows: **%APPDATA%/READIT/**
- macOS: **~/Library/Application Support/READIT/**
- Linux: **~/.config/READIT/**

Packaged exports are placed in the **exports/** directory below user data. The portable Windows executable is portable as an application artifact, but it intentionally continues to use the OS user-data directory rather than writing beside the executable.

Packaged immutable resources include:

- config/csp.json
- config/app.config.json
- ordered SQL migrations
- app.asar
- the unpacked Electron SQLite binding and ABI manifest

The application never writes to app.asar, Program Files, a macOS application bundle, or a Linux installation directory.

## Architecture

~~~text
React renderer (sandboxed, untrusted)
          |
          | window.readit versioned capabilities
          v
Preload contextBridge (narrow API)
          |
          | validated request/response contracts
          v
Electron main process
    |          |             |
    |          |             +-- OS browser, backup, diagnostics
    |          +-- bounded scheduler and RSS synchronization
    +-- SQLite lifecycle, migrations, DAOs
~~~

### Responsibilities

| Layer | Owns | Must not own |
| --- | --- | --- |
| Renderer | React UI, local presentation state, layout interaction | Electron, Node.js, filesystem, SQLite, direct navigation |
| Preload | Typed contextBridge methods and validated pushed events | Raw ipcRenderer or arbitrary channels |
| Main | IPC validation, window policy, scheduler, exports, external shell | Trust in renderer-provided values |
| Core RSS | URL policy, fetch, discovery, parse, dedupe, sync | Renderer behavior |
| Core storage | Migrations, DAOs, transactions, portability | Network or renderer behavior |
| Shared | Stable wire types and reusable pure contracts | Privileged runtime APIs |

## RSS Synchronization Contract

The canonical pipeline is under **app/core/rss/**:

1. Normalize and validate a public HTTP(S) URL.
2. Load ETag and Last-Modified cache validators.
3. Fetch with timeout, redirect, and response-size limits.
4. Revalidate redirect destinations.
5. Handle HTTP 304 without parsing.
6. Parse RSS or Atom using the shared parser.
7. Compute the stable shared deduplication key.
8. Persist metadata, items, cache state, and fetch logs transactionally.
9. Return deterministic refresh counts and structured errors.

Website autodiscovery inspects RSS/Atom alternate links and validates each candidate before use. Feed semantics are identical in development and packaged applications.

## SQLite Contract

Core tables:

- **sections:** stable key, name, and display position.
- **feeds:** normalized URL, metadata, HTTP cache state, interval, enabled/muted state, and last error.
- **feed_sections:** many-to-many section mapping.
- **items:** source article and stable deduplication key.
- **item_state:** canonical read and important flags.
- **settings:** persisted layout and UI preferences.
- **fetch_log:** synchronization outcomes.
- **schema_migrations:** append-only applied migration ledger.

Migration rules:

- SQL migration files are append-only.
- Filenames use ordered NNN_name.sql format.
- Fresh and legacy databases apply migrations transactionally.
- Tests always pass an explicit temporary database directory.
- Packaged migrations are immutable extra resources.
- Catalog seeding is additive and versioned; user-created data is preserved.

## Security Model

### Electron boundary

~~~text
contextIsolation: true
nodeIntegration: false
sandbox: true
~~~

- New windows are denied.
- Renderer navigation is prevented.
- External HTTP(S) articles open only through an allowlisted main-process handler.
- The preload exposes no raw IPC, filesystem, shell, database, or Node capability.
- Every IPC payload rejects unknown fields and validates type, range, length, and protocol.

### Content Security Policy

The bundled CSP permits local scripts/styles, HTTPS images, and data images while denying objects, frames, remote scripts, and base URL mutation. Packaging loads the same immutable CSP from process.resourcesPath and does not weaken it.

### Feed content and network boundary

- Feed descriptions remain untrusted and are sanitized before display.
- file, custom, localhost, private literal IPv4, and common local IPv6 URLs are rejected.
- Redirect count, timeout, and response bytes are bounded.
- Known limitation: hostname DNS resolution is not yet checked against private-address rebinding. Do not treat READIT as a hardened crawler for hostile multi-tenant environments.

### ASAR and native code

Application JavaScript and renderer assets are packed in ASAR. The Electron ABI better-sqlite3 binary is explicitly unpacked and selected through an ABI/version/architecture manifest. The normal Node ABI binary is not shipped as the application runtime binding.

## Repository Structure

~~~text
NEWSFEED/
|-- app/
|   |-- config/                 Versioned default catalog
|   |-- core/
|   |   |-- rss/                Validation, discovery, fetch, parse, sync
|   |   |-- runtime/            Development/packaged path contract
|   |   +-- storage/            SQLite lifecycle, migrations, DAOs
|   |-- main/                   Bootstrap, IPC, security, exports, scheduler
|   |-- preload/                Sandboxed contextBridge
|   |-- renderer/               React workspace
|   +-- shared/                 Wire contracts and shared values
|-- assets/                     Windows, macOS, and Linux icons
|-- config/                     CSP and immutable app configuration
|-- docs/                       Release operations
|-- scripts/                    Build, native ABI, icon, package verification
|-- tests/                      Unit, DB, security, UI, and e2e suites
|-- electron-builder.yml        Packaging contract
|-- vite.config.mjs             Renderer/test build
|-- vite.preload.config.mjs     Preload bundle
|-- package.json                Commands and runtime metadata
+-- release/                    Generated packages; never committed
~~~

## Troubleshooting

### Native module ABI mismatch

Symptoms include NODE_MODULE_VERSION errors or a blank startup after SQLite initialization fails.

~~~text
npm rebuild better-sqlite3
npm run rebuild:native
node scripts/verify-native.cjs
npm run build
npm start
~~~

The preparation script restores the Node binding even when Electron rebuilding fails.

### Blank renderer

~~~text
npm run build
npm start
~~~

Inspect main-process logs for preload, CSP, renderer-load, or storage startup failures. Packaged verification separately checks the main entry, preload, renderer index, native binding, and migrations.

### Migration failure

Do not delete the database first. Back it up, inspect schema_migrations, and reproduce against a copy. Tests never mutate the development database.

### Feed test fails

Verify that the endpoint:

- uses public HTTP or HTTPS;
- returns RSS/Atom XML or advertises a valid alternate;
- remains within response limits;
- does not redirect to a blocked host;
- is reachable without browser-only authentication.

### Packaged app cannot find resources

Run:

~~~text
npm run pack
npm run verify:package
~~~

The verifier reports missing ASAR entries, config, migrations, or native resources precisely.

### App writes to the wrong directory

Development intentionally uses repository data/. Packaged builds must report app.getPath("userData") and must never report a path inside resources. The packaged smoke test enforces this.

### Icon is missing

~~~text
npm run validate:icons
~~~

Windows uses assets/sa-odia.ico, macOS uses assets/sa-odia.icns, and Linux uses assets/icons/256x256.png.

### Signing or notarization fails

Confirm the certificate is valid for the target, credentials are available only in the release environment, timestamps are reachable, hardened runtime is enabled on macOS, and the build runs on the target OS. See the release guide.

## Project Status and Known Release Gaps

Implemented and verified in source:

- reproducible build and validation;
- strict Electron security boundary;
- electron-builder configuration;
- Windows, macOS, and Linux target definitions;
- ASAR packaging and native unpack policy;
- packaged runtime path separation;
- packaged structure and SQLite smoke verifier;
- unsigned release CI matrix.

Deferred:

- automated signing and notarization;
- public checksums and provenance attestations;
- auto-update design and signature policy;
- packaged Playwright UI automation on all targets;
- DNS-resolution-aware SSRF defense;
- article/fetch-log retention policy;
- crash reporting and telemetry policy.

## Contributing Rules

- Never import Electron, Node.js, filesystem, or SQLite into renderer code.
- Add shared TypeScript types and runtime validators together.
- Reject unknown IPC fields.
- Keep URL validation and deduplication centralized.
- Add schema changes as new migrations; never rewrite a released migration.
- Use temporary databases in tests.
- Preserve the dual Node/Electron native ABI strategy.
- Never package or commit dist, release, local data, exports, logs, or coverage.
- Run **npm run validate** before review.
- Run **npm run validate:release** for release-affecting changes.

## License

See [LICENSE](LICENSE).
