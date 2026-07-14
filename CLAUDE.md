# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a Chrome extension (Manifest V3) - no build commands needed. To develop:

1. Load the extension in Chrome:
   - Open Chrome → Extensions → Developer mode → "Load unpacked"
   - Select this directory
2. Test changes: Make code edits, then reload the extension in Chrome
3. Debug: Set `GDMD_DEBUG = true` in content.js, then use Chrome DevTools console to see `[GDMD]` logs

## Architecture Overview

### Core Architecture
This is a Chrome extension that automatically detects and renders markdown files in Google Drive preview mode. It uses a two-level MutationObserver architecture — zero timeouts, zero polling — to react to Drive's DOM changes as they happen.

### Key Components

**content.js** - Main content script injected into Google Drive pages
- `GoogleDriveMarkdownPreview` class handles the entire lifecycle
- Two-level observer architecture (see below)
- `_tryRenderPre(docEl)` - Checks a document element for an unrendered `.md` `<pre>` and renders it
- `renderMarkdown(contentEl, rawText, filename)` - Converts markdown via marked.js and sanitizes with DOMPurify
- `printRendered(rendered, filename)` - Prints the rendered markdown (see Print below)

**background.js** - Service worker for extension lifecycle
- Detects SPA navigations via `chrome.webNavigation.onHistoryStateUpdated` and notifies content script
- Deduplicates navigation events per tab with a URL map
- Manages `chrome.storage.sync` for user preferences (enabled, theme)
- Relays settings changes to all Drive tabs

**popup.js/popup.html** - Settings UI for enabling/disabling and theme selection

**styles/markdown.css** - GitHub-style markdown rendering with light/dark theme support

### Google Drive DOM Structure
Drive caches multiple file previews in the DOM simultaneously. The extension targets:
```html
<!-- Multiple of these can coexist (cached by Drive) -->
<div role="document" aria-label="Displaying filename.md">
  <!-- The <pre> holds the markdown. Drive uses different obfuscated class
       names on different routes (e.g., a-b-r-La on /drive/home, and
       ndfHFb-c4YZDc-fmcmS-DARUcf on /file/d/.../view) and rotates them
       over time. The extension matches by structure, not class. -->
  <pre><!-- markdown content --></pre>
</div>
```

The extension is also injected on `studio.workspace.google.com` (where Drive embeds previews from Workspace) with `all_frames: true`, so the content script reaches the preview frame regardless of how Drive wraps it.

### Critical Implementation Details

**Two-level MutationObserver architecture (no timeouts)**:

1. **Body observer** (`document.body`, `childList + subtree`) — Watches for any `[role="document"]` element being added anywhere in the page. Does NOT filter on `aria-label` at this stage because Drive may set the label after inserting the element. When a document element is found, calls `renderDocElement()`.

2. **Doc element observer** (per `[role="document"]`, `childList + subtree + characterData + attributes[aria-label]`) — Persistent observer on each document element. Fires when:
   - Drive sets/changes the `aria-label` attribute (catches deferred label assignment)
   - Drive adds the `<pre>` child (catches deferred content population)
   - Drive swaps children on keyboard navigation (catches file switching in an existing container)
   - Skips mutations whose target is inside our injected DOM (`.gdmd-markdown-content`, `.gdmd-toggle-container`) — see `_isInsideOwnDom`. Without this, the toggle button's text change ("Show Raw" ↔ "Show Rendered") would fire the observer and trigger a re-render on every click.

**Why two levels**: Drive uses two different patterns depending on how the user navigates:
- **Double-click**: Creates a new `[role="document"]` element → body observer catches it
- **Keyboard nav (arrow keys)**: Sometimes reuses an existing document element and swaps its children, sometimes creates a new one in a new panel → doc element observer catches the reuse case, body observer catches the new panel case

**Structural `<pre>` matching**: `_tryRenderPre` picks the largest `<pre>` inside the document container by text length. This survives Drive's class-name rotations and incidentally skips any header-style `<pre>` that might share the container.

**Filename regex**: The `aria-label` match is `/Displaying\s+(.+\.md)$/i`. The `.+` (not `[^\s]+`) is required so filenames with spaces match — e.g., `Displaying UFC - Ultimate Fighting Championship.md`.

**Security**: All rendered HTML is sanitized through `DOMPurify.sanitize()` before DOM insertion to prevent XSS from malicious markdown content.

**Already-rendered check**: A `<pre>` is considered already rendered if any sibling has the `.gdmd-markdown-content` class. The check does not depend on the `<pre>`'s `display` state — the user may have toggled to "Show Raw," which makes the `<pre>` visible, but we still don't want to re-render.

**Print (`printRendered`)**: Chrome's native print inside a Drive preview prints the raw `<pre>` wrapped in Drive's chrome, not our rendered output. Rather than fight Drive's layout with `@media print` rules (unreliable — Drive rotates class names and nests preview frames, so hiding "everything but our div" in place isn't feasible), the Print button opens a fresh `window.open('', '_blank')` we fully control, writes a self-contained document (inlined light-theme CSS from `printStyles()` + the rendered HTML + the filename as the title), and calls `print()` on that window. Notes:
- `window.open` runs synchronously inside the button's click handler so it isn't treated as an unsolicited popup.
- The rendered node is cloned and its `<img>` `src`s are resolved to absolute URLs (`new URL(src, location.href)`) — relative srcs wouldn't load in the new window's origin.
- Print output is always light theme regardless of the user's theme setting; `printStyles()` defines no `.gdmd-dark` rules, so a cloned dark wrapper still renders light.
- The Print and toggle buttons share `.gdmd-toggle-button`; they're spaced with a `.gdmd-toggle-button + .gdmd-toggle-button` sibling margin.

## Releases

Releases are tag-driven via `.github/workflows/release.yml`. To cut a release:

1. Bump `version` in `manifest.json` to the new semver (e.g., `1.3.1`)
2. Commit the bump
3. Tag with a matching `v` prefix and push:
   ```bash
   git tag v1.3.1
   git push origin main v1.3.1
   ```

The workflow verifies the tag matches `manifest.json` (fails fast if not), builds a zip excluding repo-only files (`.git`, `.github`, `CLAUDE.md`, `README.md`), and creates a GitHub Release with auto-generated notes. Edit the release in the browser if you want to add prose.
