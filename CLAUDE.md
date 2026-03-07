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
This is a Chrome extension that automatically detects and renders markdown files in Google Drive preview mode. It uses event-driven triggers with a simple scan-all-and-render approach to handle Google Drive's dynamic, cached DOM.

### Key Components

**content.js** - Main content script injected into Google Drive pages
- `GoogleDriveMarkdownPreview` class handles the entire lifecycle
- `tryDetectAndRender()` - Scans ALL `[role="document"]` elements for unrendered `.md` previews
- `renderMarkdown(contentEl, rawText)` - Converts markdown via marked.js and sanitizes with DOMPurify
- Three event triggers: dblclick, `navigationChanged` message from service worker, ArrowLeft/ArrowRight keydown
- `scheduleDetection(delay)` - Debounces trigger events before scanning

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

**Render-all strategy**: Drive caches previous file previews in the DOM — old `[role="document"]` elements persist alongside new ones. Rather than trying to identify the "current" file (which is fragile), the extension scans all document elements and renders any `<pre class="a-b-r-La">` that hasn't already been rendered. The "already rendered" check is a simple DOM test: if the `<pre>` is hidden and its next sibling is our `.gdmd-markdown-content` wrapper, it's already done.

**Two elements with same class**: There are two elements with class `a-b-r-La` inside each document container — a header element and the `<pre>` with actual content. The selector `pre.a-b-r-La` targets only the correct one.

**Security**: All rendered HTML is sanitized through `DOMPurify.sanitize()` before DOM insertion to prevent XSS from malicious markdown content.

**Event triggers (not polling)**: Detection is driven by three events, not continuous polling:
1. `dblclick` — user opens a file from the file list (300ms debounce)
2. `navigationChanged` message — SPA navigation detected by the service worker (300ms debounce)
3. `ArrowLeft`/`ArrowRight` keydown — keyboard navigation in Drive's viewer (600ms debounce, Drive needs time to swap content)
