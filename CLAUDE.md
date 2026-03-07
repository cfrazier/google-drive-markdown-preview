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
- `renderMarkdown(contentEl, rawText)` - Converts markdown via marked.js and sanitizes with DOMPurify

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
  <!-- Two elements share class 'a-b-r-La': a header and the <pre> -->
  <pre class="a-b-r-La"><!-- markdown content --></pre>
</div>
```

### Critical Implementation Details

**Two-level MutationObserver architecture (no timeouts)**:

1. **Body observer** (`document.body`, `childList + subtree`) — Watches for any `[role="document"]` element being added anywhere in the page. Does NOT filter on `aria-label` at this stage because Drive may set the label after inserting the element. When a document element is found, calls `renderDocElement()`.

2. **Doc element observer** (per `[role="document"]`, `childList + subtree + characterData + attributes[aria-label]`) — Persistent observer on each document element. Fires when:
   - Drive sets/changes the `aria-label` attribute (catches deferred label assignment)
   - Drive adds the `<pre>` child (catches deferred content population)
   - Drive swaps children on keyboard navigation (catches file switching in an existing container)
   - Filters out mutations caused by our own DOM insertions (`.gdmd-markdown-content`, `.gdmd-toggle-container`)

**Why two levels**: Drive uses two different patterns depending on how the user navigates:
- **Double-click**: Creates a new `[role="document"]` element → body observer catches it
- **Keyboard nav (arrow keys)**: Sometimes reuses an existing document element and swaps its children, sometimes creates a new one in a new panel → doc element observer catches the reuse case, body observer catches the new panel case

**Two elements with same class**: There are two elements with class `a-b-r-La` inside each document container — a header element and the `<pre>` with actual content. The selector `pre.a-b-r-La` targets only the correct one.

**Security**: All rendered HTML is sanitized through `DOMPurify.sanitize()` before DOM insertion to prevent XSS from malicious markdown content.

**Already-rendered check**: Simple DOM test — if the `<pre>` is hidden (`display: none`) and its next sibling is our `.gdmd-markdown-content` wrapper, skip it. No hash tracking needed.
