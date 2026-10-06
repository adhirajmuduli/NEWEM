# READIT Release Engineering

This is the operational release checklist. The root README covers development and user workflows.

## Release Policy

- **npm run validate** is the merge gate.
- **npm run validate:release** adds an unpacked package and packaged SQLite smoke test for the current platform.
- Public artifacts must be built on their target operating system because READIT contains better-sqlite3.
- Unsigned artifacts are suitable for internal testing only.
- Installers never contain data/app.db, exports, logs, coverage, tests, or repository source.

## Clean Release Sequence

~~~text
npm ci
npm run rebuild:native
npm run validate
npm run dist
npm run verify:package
~~~

Artifacts are written under release/. The package verifier checks ASAR contents, immutable resources, the unpacked Electron-native SQLite binding, migrations, and an actual noninteractive packaged startup using temporary user data.

## Platform Matrix

| Host | Supported artifacts | Notes |
| --- | --- | --- |
| Windows | NSIS installer, portable executable | Build and sign on Windows |
| macOS | DMG, ZIP | Build, sign, and notarize on macOS |
| Linux | AppImage, DEB | Build on Linux; DEB metadata is configured |

**npm run dist:all** is a best-effort builder invocation, not a claim of reliable cross-compilation. Native modules and macOS signing require target-platform jobs.

## Native SQLite

READIT intentionally keeps two binaries:

- the normal better_sqlite3.node for Node and Vitest;
- build/Release/electron/better_sqlite3.node plus manifest.json for Electron.

**npm run rebuild:native** temporarily rebuilds the standard binding, copies the Electron ABI result, and restores the Node binding in a finally block. Packaging sets npmRebuild to false, includes the prepared Electron binding, and unpacks it from ASAR. Do not remove this setting without replacing the dual-ABI contract.

**npm run install:app-deps** is available for diagnosing builder-native dependency installation. It immediately restores the Node binding and regenerates READIT's separate Electron binding.

## Windows Signing

Unsigned NSIS and portable builds remain available locally. Public distribution requires an Authenticode certificate:

- CSC_LINK: certificate file, URL, or base64 value;
- CSC_KEY_PASSWORD: certificate password.

Use a hardware-backed or CI-managed certificate where possible. Timestamp and verify the resulting executable before publishing.

## macOS Signing and Notarization

Requirements:

- Apple Developer Program membership;
- Developer ID Application certificate in the build keychain;
- hardened runtime, already enabled;
- notarization credentials.

Signing commonly uses CSC_LINK and CSC_KEY_PASSWORD. Notarization can use Apple ID credentials (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID) or an App Store Connect API key supported by the active electron-builder version. Keep credentials in CI secrets. No Apple credentials are stored here.

## Linux Distribution

AppImage and DEB builds are configured. Public releases should publish SHA-256 checksums and may sign repository metadata or detached checksums. Linux package signing is not automated.

## CI

The release-build workflow runs locked installs, validation, current-platform packaging, packaged smoke verification, and artifact upload on Windows, macOS, and Ubuntu. It does not publish a GitHub Release and disables automatic signing identity discovery.

## Manual Acceptance

1. Install or mount the artifact on a clean target-system account.
2. Confirm first launch creates sections and feeds.
3. Add and refresh a public RSS feed.
4. Restart and confirm read state, layout, and section settings persist.
5. Export OPML, a database backup, and diagnostics.
6. Confirm links open in the system browser and cannot navigate the READIT window.
7. Confirm application data is under the OS user-data directory.
8. Scan and sign or notarize artifacts before public distribution.

## Deferred Release Hardening

- Automated code signing, notarization, checksums, and provenance attestations.
- Auto-update policy and update signature verification.
- Packaged Playwright UI journeys on all three operating systems.
- DNS-resolution-aware SSRF protection for feed hostnames.
- Formal retention policies for articles and fetch logs.
