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
    this._bodyObserver = null;
    this._docObservers = new Map();

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

  _isInsideOwnDom(node) {
    // True if node is, or is contained within, one of our injected elements.
    // Mutations inside our DOM (e.g. toggle button text changes) must not
    // trigger re-renders. Text nodes have no .closest(), so walk up manually.
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    while (el) {
      if (this._isOwnElement(el)) return true;
      el = el.parentElement;
    }
    return false;
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
    const mdMatch = ariaLabel.match(/Displaying\s+(.+\.md)$/i);
    if (!mdMatch) return false;

    // Match by structure rather than class: Drive uses different obfuscated
    // class names on different routes (e.g., a-b-r-La on /drive/home vs.
    // ndfHFb-c4YZDc-fmcmS-DARUcf on /file/d/.../view) and rotates them over
    // time. Picking the largest <pre> reliably skips any header-style <pre>
    // that may share the container.
    const pres = Array.from(docEl.querySelectorAll('pre'));
    let pre = null;
    let textLen = 0;
    for (const candidate of pres) {
      const len = candidate.textContent?.trim().length || 0;
      if (len > textLen) { pre = candidate; textLen = len; }
    }

    if (!pre || textLen === 0) {
      gdmdLog('detect: <pre> not ready in "' + mdMatch[1] + '"');
      return false;
    }

    // Already-rendered check: look for our wrapper as a sibling regardless of
    // the <pre>'s display state. The user may have toggled to "Show Raw",
    // which makes the <pre> visible — we still don't want to re-render.
    const siblings = pre.parentNode ? Array.from(pre.parentNode.children) : [];
    if (siblings.some(el => el.classList?.contains('gdmd-markdown-content'))) {
      gdmdLog('detect: already rendered "' + mdMatch[1] + '", skipping');
      return true;
    }

    gdmdLog('detect: rendering "' + mdMatch[1] + '" (' + textLen + ' chars)');
    this.renderMarkdown(pre, pre.textContent, mdMatch[1]);
    return true;
  }

  // Persistent observer on a document element. Fires when Drive swaps
  // children (keyboard nav) or when the <pre> is first populated.
  _watchDocElement(docEl) {
    if (this._docObservers.has(docEl)) return;

    const observer = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;
      // Skip mutations that originate inside our own DOM. The toggle button's
      // text changes (Show Raw ↔ Show Rendered) are characterData mutations
      // on a text node inside .gdmd-toggle-container, which lives in docEl's
      // subtree. Without this guard, every toggle click triggers a re-render.
      let hasExternalChange = false;
      for (const m of mutations) {
        if (this._isInsideOwnDom(m.target)) continue;

        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && !this._isOwnElement(node)) {
            hasExternalChange = true;
            break;
          }
        }
        if (hasExternalChange) break;
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
    this._docObservers.set(docEl, observer);
    gdmdLog('observer: watching docElement: ' + docEl.getAttribute('aria-label'));
  }

  renderMarkdown(contentEl, rawText, filename) {
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

      this.addToggleButton(contentEl, filename);
      gdmdLog('render: SUCCESS — ' + rawText.length + ' chars');
    } catch (error) {
      gdmdLog('render: ERROR —', error.message);
    }
  }

  addToggleButton(contentEl, filename) {
    const container = document.createElement('div');
    container.className = 'gdmd-toggle-container';

    const toggleButton = document.createElement('button');
    toggleButton.className = 'gdmd-toggle-button';
    toggleButton.textContent = 'Show Raw';
    toggleButton.title = 'Toggle between rendered and raw markdown';

    toggleButton.addEventListener('click', () => {
      // Find our rendered wrapper among the <pre>'s siblings. Don't rely on
      // nextSibling — it can return whitespace text nodes — and don't rely
      // on positioning since other code may insert things between.
      const siblings = contentEl.parentNode ? Array.from(contentEl.parentNode.children) : [];
      const rendered = siblings.find(el => el.classList?.contains('gdmd-markdown-content'));
      if (contentEl.style.display === 'none') {
        contentEl.style.display = 'block';
        if (rendered) rendered.style.display = 'none';
        toggleButton.textContent = 'Show Rendered';
      } else {
        contentEl.style.display = 'none';
        if (rendered) rendered.style.display = 'block';
        toggleButton.textContent = 'Show Raw';
      }
    });

    const printButton = document.createElement('button');
    printButton.className = 'gdmd-toggle-button gdmd-print-button';
    printButton.textContent = 'Print';
    printButton.title = 'Print the rendered markdown';

    printButton.addEventListener('click', () => {
      const siblings = contentEl.parentNode ? Array.from(contentEl.parentNode.children) : [];
      const rendered = siblings.find(el => el.classList?.contains('gdmd-markdown-content'));
      if (rendered) this.printRendered(rendered, filename);
    });

    container.appendChild(printButton);
    container.appendChild(toggleButton);
    contentEl.parentNode.insertBefore(container, contentEl);
  }

  // Print the rendered markdown by opening a fresh window we fully control,
  // rather than fighting Drive's print layout with @media print rules. Drive
  // rotates class names and nests preview frames, so reliably hiding
  // "everything but our div" in place isn't feasible. A blank window with only
  // the rendered HTML + inlined print CSS gives clean, predictable output.
  printRendered(rendered, filename) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      gdmdLog('print: window.open blocked (popup blocker?)');
      return;
    }

    // Clone so we can resolve relative image URLs to absolute without touching
    // the live DOM. Images with relative src won't load in the new window,
    // whose base URL differs from the Drive page.
    const clone = rendered.cloneNode(true);
    clone.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (src) img.setAttribute('src', new URL(src, location.href).href);
    });

    const title = filename || 'Markdown';
    // Always light theme for print — dark backgrounds waste ink and aren't
    // what people want on paper/PDF. Title is set via the property setter (plain
    // text, not HTML-parsed); the body HTML is our own already-sanitized markup.
    const doc = printWindow.document;
    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8"><title></title>' +
      '<style>' + this.printStyles() + '</style></head>' +
      '<body class="gdmd-print"></body></html>'
    );
    doc.close();
    doc.title = title;
    doc.body.innerHTML = clone.outerHTML;

    // Print once content and any images have settled. onload fires after the
    // freshly written document (including images) finishes loading.
    const doPrint = () => {
      printWindow.focus();
      printWindow.print();
    };
    if (doc.readyState === 'complete') {
      doPrint();
    } else {
      printWindow.addEventListener('load', doPrint, { once: true });
    }
    gdmdLog('print: opened print window for "' + title + '"');
  }

  // Light-theme styles for the print window, derived from markdown.css. Kept
  // self-contained because the extension's injected stylesheet does not reach
  // a window we open. Strips the on-page chrome (box-shadow, buttons).
  printStyles() {
    return `
      body.gdmd-print { margin: 0; }
      .gdmd-markdown-content {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px; line-height: 1.6; color: #333; background: #fff;
        padding: 24px; margin: 0; max-width: 900px;
      }
      .gdmd-markdown-content h1, .gdmd-markdown-content h2, .gdmd-markdown-content h3,
      .gdmd-markdown-content h4, .gdmd-markdown-content h5, .gdmd-markdown-content h6 {
        margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; color: #1a1a1a;
      }
      .gdmd-markdown-content h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 8px; }
      .gdmd-markdown-content h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 8px; }
      .gdmd-markdown-content h3 { font-size: 1.25em; }
      .gdmd-markdown-content h4 { font-size: 1em; }
      .gdmd-markdown-content h5 { font-size: 0.875em; }
      .gdmd-markdown-content h6 { font-size: 0.85em; color: #6a737d; }
      .gdmd-markdown-content p { margin-bottom: 16px; }
      .gdmd-markdown-content blockquote { margin: 0 0 16px 0; padding: 0 16px; color: #6a737d; border-left: 4px solid #dfe2e5; }
      .gdmd-markdown-content ul, .gdmd-markdown-content ol { margin-bottom: 16px; padding-left: 32px; }
      .gdmd-markdown-content li { margin-bottom: 4px; }
      .gdmd-markdown-content li p { margin-bottom: 8px; }
      .gdmd-markdown-content a { color: #0366d6; text-decoration: none; }
      .gdmd-markdown-content code {
        background-color: rgba(27, 31, 35, 0.05); border-radius: 3px; font-size: 85%; margin: 0;
        padding: 0.2em 0.4em; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      }
      .gdmd-markdown-content pre {
        background-color: #f6f8fa; border-radius: 6px; font-size: 85%; line-height: 1.45;
        overflow: auto; padding: 16px; margin-bottom: 16px;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        white-space: pre-wrap; word-wrap: break-word;
      }
      .gdmd-markdown-content pre code {
        background-color: transparent; border: 0; display: inline; line-height: inherit;
        margin: 0; padding: 0; word-wrap: normal;
      }
      .gdmd-markdown-content table { border-collapse: collapse; border-spacing: 0; margin-bottom: 16px; width: 100%; }
      .gdmd-markdown-content table th, .gdmd-markdown-content table td { border: 1px solid #dfe2e5; padding: 6px 13px; }
      .gdmd-markdown-content table th { background-color: #f6f8fa; font-weight: 600; }
      .gdmd-markdown-content table tr:nth-child(2n) { background-color: #f6f8fa; }
      .gdmd-markdown-content img { max-width: 100%; height: auto; margin: 8px 0; }
      .gdmd-markdown-content hr { border: 0; height: 1px; background: #e1e4e8; margin: 24px 0; }
      .gdmd-markdown-content strong { font-weight: 600; }
      .gdmd-markdown-content em { font-style: italic; }
      .gdmd-markdown-content del { text-decoration: line-through; }
      @media print {
        .gdmd-markdown-content pre, .gdmd-markdown-content blockquote,
        .gdmd-markdown-content table { page-break-inside: avoid; }
        .gdmd-markdown-content h1, .gdmd-markdown-content h2, .gdmd-markdown-content h3 { page-break-after: avoid; }
      }
    `;
  }

  cleanup() {
    this._docObservers.forEach(obs => obs.disconnect());
    this._docObservers.clear();

    document.querySelectorAll('.gdmd-toggle-container').forEach(el => el.remove());
    document.querySelectorAll('.gdmd-markdown-content').forEach(el => el.remove());
    document.querySelectorAll('pre[style*="display: none"]')
      .forEach(el => { el.style.display = ''; });
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GoogleDriveMarkdownPreview());
} else {
  new GoogleDriveMarkdownPreview();
}
