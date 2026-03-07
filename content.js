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
    this._bodyObserver = null;

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
    // Settings changes from popup
    chrome.runtime?.onMessage?.addListener((request) => {
      if (request.action === 'settingsChanged') {
        this.isEnabled = request.settings?.enabled !== false;
        this.theme = request.settings?.theme || 'light';
        gdmdLog('settings changed: enabled=' + this.isEnabled, 'theme=' + this.theme);
        this.applyTheme();
        if (!this.isEnabled) {
          this.cleanup();
        }
      }
    });

    // Primary detection: observe the entire document for [role="document"]
    // elements being added. This catches every way Drive loads file previews —
    // double-click, keyboard nav, SPA navigation — with zero timeouts.
    this._bodyObserver = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (this._isOwnElement(node)) continue;

          // Check if the added node is or contains a [role="document"] element.
          // Don't filter on aria-label here — Drive may set it after insertion.
          // The .md check happens later in _tryRenderPre.
          const docs = [];
          if (node.getAttribute?.('role') === 'document') {
            docs.push(node);
          } else if (node.querySelectorAll) {
            docs.push(...node.querySelectorAll('[role="document"]'));
          }

          for (const doc of docs) {
            gdmdLog('trigger: observer saw document element: ' + (doc.getAttribute('aria-label') || '(no label yet)'));
            this.renderDocElement(doc);
          }
        }
      }
    });

    this._bodyObserver.observe(document.body, { childList: true, subtree: true });
    gdmdLog('observer: watching document.body for new document elements');
  }

  _isOwnElement(node) {
    return node.classList?.contains('gdmd-markdown-content') ||
           node.classList?.contains('gdmd-toggle-container');
  }

  // Render a specific document element. If the <pre> isn't populated yet,
  // watch for it to appear. Drive adds the container first, then fills it.
  // Also keeps a persistent observer for keyboard nav (Drive reuses the
  // same document element and swaps its children).
  renderDocElement(docEl) {
    this._tryRenderPre(docEl);
    this._watchDocElement(docEl);
  }

  _tryRenderPre(docEl) {
    const ariaLabel = docEl.getAttribute('aria-label') || '';
    const mdMatch = ariaLabel.match(/Displaying\s+([^\s]+\.md)/i);
    if (!mdMatch) return false;

    const pre = docEl.querySelector('pre.a-b-r-La');
    const textLen = pre ? (pre.textContent?.trim().length || 0) : 0;

    if (!pre || textLen === 0) {
      gdmdLog('detect: <pre> not ready in "' + mdMatch[1] + '"');
      return false;
    }

    if (pre.style.display === 'none' && pre.nextElementSibling?.classList.contains('gdmd-markdown-content')) {
      gdmdLog('detect: already rendered "' + mdMatch[1] + '", skipping');
      return true;
    }

    gdmdLog('detect: rendering "' + mdMatch[1] + '" (' + textLen + ' chars)');
    this.renderMarkdown(pre, pre.textContent);
    return true;
  }

  // Persistent observer on a document element. Fires when Drive swaps
  // children (keyboard nav) or when the <pre> is first populated.
  _watchDocElement(docEl) {
    // Don't double-observe the same element
    if (docEl._gdmdObserved) return;
    docEl._gdmdObserved = true;

    const observer = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;
      // Check if any mutation includes a non-own element being added.
      // If the only changes are our own insertions, skip.
      let hasExternalChange = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && !this._isOwnElement(node)) {
            hasExternalChange = true;
            break;
          }
        }
        if (hasExternalChange) break;
        // Also treat characterData, attribute changes, and removals as external
        if (m.type === 'characterData' || m.type === 'attributes' || m.removedNodes.length > 0) {
          hasExternalChange = true;
          break;
        }
      }
      if (!hasExternalChange) return;
      gdmdLog('trigger: docElement children changed (' + docEl.getAttribute('aria-label') + ')');
      this._tryRenderPre(docEl);
    });

    observer.observe(docEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
    gdmdLog('observer: watching docElement: ' + docEl.getAttribute('aria-label'));
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
