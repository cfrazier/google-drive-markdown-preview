const GDMD_DEBUG = false;

function gdmdLog(...args) {
  if (GDMD_DEBUG) {
    console.log('[GDMD]', ...args);
  }
}

class GoogleDriveMarkdownPreview {
  constructor() {
    this.isEnabled = true;
    this.theme = 'light';
    this.toggleButton = null;
    this._debounceTimer = null;
    this._keyboardBound = false;

    gdmdLog('constructor: initializing');
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupListeners();
    gdmdLog('init: ready, enabled=' + this.isEnabled, 'theme=' + this.theme);
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['enabled', 'theme']);
      this.isEnabled = result.enabled !== false;
      this.theme = result.theme || 'light';
    } catch (error) {
      this.isEnabled = true;
      this.theme = 'light';
    }
  }

  applyTheme() {
    const wrapper = document.querySelector('.gdmd-markdown-content');
    if (wrapper) {
      wrapper.classList.toggle('gdmd-dark', this.theme === 'dark');
    }
  }

  setupListeners() {
    // Trigger 1: Double-click on a file in the file list
    document.addEventListener('dblclick', () => {
      gdmdLog('trigger: dblclick');
      this.scheduleDetection(300);
    });

    // Trigger 2: SPA navigation detected by the service worker
    chrome.runtime?.onMessage?.addListener((request) => {
      if (request.action === 'navigationChanged') {
        gdmdLog('trigger: navigationChanged, url=' + request.url);
        this.scheduleDetection(300);
      } else if (request.action === 'settingsChanged') {
        this.isEnabled = request.settings?.enabled !== false;
        this.theme = request.settings?.theme || 'light';
        gdmdLog('settings changed: enabled=' + this.isEnabled, 'theme=' + this.theme);
        this.applyTheme();
        if (!this.isEnabled) {
          this.cleanup();
        }
      }
    });
  }

  // Bind a keyboard listener on the viewer dialog to catch arrow-key navigation.
  // Called once per dialog element; the listener persists for the dialog's lifetime.
  bindKeyboardNav(dialog) {
    if (this._keyboardBound) return;
    this._keyboardBound = true;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        gdmdLog('trigger: keyboard ' + e.key);
        // Drive swaps content after the keydown; give it time to update the DOM
        this.scheduleDetection(600);
      }
    });
  }

  scheduleDetection(delay = 300) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.tryDetectAndRender();
    }, delay);
  }

  // Find all unrendered markdown <pre> elements and render them.
  // Drive caches previous file previews in the DOM, so multiple
  // [role="document"] elements can coexist. Instead of guessing which
  // is "current," we render every .md file's <pre> that hasn't already
  // been rendered.
  tryDetectAndRender() {
    if (!this.isEnabled) return;
    if (!window.location.href.includes('drive.google.com')) return;

    // Find the viewer dialog and bind keyboard nav if present
    const viewerDialog = document.querySelector('[role="dialog"][aria-label="Showing viewer."]');
    if (viewerDialog && viewerDialog.getAttribute('aria-hidden') !== 'true') {
      this.bindKeyboardNav(viewerDialog);
    }

    // Find ALL document elements that are displaying .md files
    const docElements = document.querySelectorAll('[role="document"][aria-label*="Displaying"]');
    let rendered = 0;

    for (const docEl of docElements) {
      const ariaLabel = docEl.getAttribute('aria-label') || '';
      const mdMatch = ariaLabel.match(/Displaying\s+([^\s]+\.md)/i);
      if (!mdMatch) continue;

      // Find the <pre> child with content (skip non-pre elements with same class)
      const pres = docEl.querySelectorAll('pre.a-b-r-La');
      for (const pre of pres) {
        const textLen = pre.textContent?.trim().length || 0;
        if (textLen === 0) continue;

        // Already rendered? Check if our wrapper is the next sibling
        if (pre.style.display === 'none' && pre.nextElementSibling?.classList.contains('gdmd-markdown-content')) {
          gdmdLog('detect: already rendered "' + mdMatch[1] + '", skipping');
          continue;
        }

        gdmdLog('detect: rendering "' + mdMatch[1] + '" (' + textLen + ' chars)');
        this.renderMarkdown(pre, pre.textContent);
        rendered++;
      }
    }

    if (rendered === 0 && docElements.length === 0) {
      gdmdLog('detect: no .md document elements found');
    }
  }

  renderMarkdown(contentEl, rawText) {
    if (!rawText.trim()) {
      gdmdLog('render: empty content, skipping');
      return;
    }

    try {
      const rawHTML = marked.parse(rawText, { gfm: true, breaks: true });
      const safeHTML = DOMPurify.sanitize(rawHTML);

      const wrapper = document.createElement('div');
      wrapper.className = 'gdmd-markdown-content';
      if (this.theme === 'dark') wrapper.classList.add('gdmd-dark');
      wrapper.innerHTML = safeHTML;

      contentEl.style.display = 'none';
      contentEl.parentNode.insertBefore(wrapper, contentEl.nextSibling);

      this.addToggleButton(contentEl);
      gdmdLog('render: SUCCESS — ' + rawText.length + ' chars');
    } catch (error) {
      gdmdLog('render: ERROR —', error.message);
    }
  }

  addToggleButton(contentEl) {
    const container = document.createElement('div');
    container.className = 'gdmd-toggle-container';

    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'gdmd-toggle-button';
    this.toggleButton.textContent = 'Show Raw';
    this.toggleButton.title = 'Toggle between rendered and raw markdown';

    this.toggleButton.addEventListener('click', () => {
      const rendered = contentEl.nextSibling;
      if (contentEl.style.display === 'none') {
        contentEl.style.display = 'block';
        if (rendered) rendered.style.display = 'none';
        this.toggleButton.textContent = 'Show Rendered';
      } else {
        contentEl.style.display = 'none';
        if (rendered) rendered.style.display = 'block';
        this.toggleButton.textContent = 'Show Raw';
      }
    });

    container.appendChild(this.toggleButton);
    contentEl.parentNode.insertBefore(container, contentEl);
  }

  cleanup() {
    document.querySelectorAll('.gdmd-toggle-container').forEach(el => el.remove());
    document.querySelectorAll('.gdmd-markdown-content').forEach(el => el.remove());
    document.querySelectorAll('pre[style*="display: none"], .a-b-r-La[style*="display: none"]')
      .forEach(el => { el.style.display = ''; });
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GoogleDriveMarkdownPreview());
} else {
  new GoogleDriveMarkdownPreview();
}
