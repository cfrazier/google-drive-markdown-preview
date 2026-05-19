# Chrome Web Store Listing — Staging Copy

Everything you'll paste into the Chrome Web Store Developer Dashboard at submission time. Edit freely before submitting.

---

## Item details

### Name
> Google Drive Markdown Preview

(Matches `manifest.json`. Don't change one without the other — Chrome rejects mismatches.)

### Summary (≤132 chars)
> Renders Markdown files in Google Drive's preview as formatted HTML. Toggle between rendered view and raw text.

(Currently 110 chars. Plain text, no superlatives, no competitor references.)

### Description (longer field — pasted into the dashboard)

```
Google Drive shows .md files as raw text. This extension renders them as formatted HTML the moment you preview them.

Features
• Automatic detection — any .md file you preview in Drive renders instantly
• GitHub-style formatting with light and dark themes
• "Show Raw" toggle to see the original markdown source
• Works with multiple cached previews and keyboard navigation
• Runs entirely in your browser — no data leaves your machine

What it doesn't do
• No analytics, no tracking, no remote servers
• No data collection beyond your local preferences (enabled/disabled, theme)
• No external network requests of any kind

Open source. Issues and contributions welcome:
https://github.com/cfrazier/google-drive-markdown-preview
```

### Category
- Primary: **Productivity**
- (Optional secondary: Developer Tools)

### Language
- English

---

## Privacy tab

### Single purpose
> Renders Markdown (.md) files displayed in Google Drive's preview pane as formatted HTML, with a toggle to show the raw source.

### Permission justifications

For each entry under `permissions` and `host_permissions`, paste these into the corresponding justification field:

**`storage`**
> Used to persist the user's two preferences — extension enabled/disabled and theme (light/dark) — via `chrome.storage.sync`. No other data is stored.

**`activeTab`**
> Required so the extension can interact with the currently-active Drive tab when the user opens the settings popup. No reads of tab content occur outside the matched origins.

**`webNavigation`**
> Used to detect SPA navigations within Google Drive (which doesn't fire a full page load when switching files). This lets the content script notice that the user opened a new markdown file and render it. Listens only on `drive.google.com` and `studio.workspace.google.com`.

**Host permissions: `https://drive.google.com/*`**
> Required to detect and render markdown files displayed inside Drive's preview UI.

**Host permissions: `https://studio.workspace.google.com/*`**
> Required because Drive sometimes embeds its preview UI inside Workspace Studio frames. Without this host, the extension cannot reach the preview in that context.

### Data handling disclosure (checkboxes)

The dashboard asks what categories of data you collect. For this extension, **uncheck all categories** — none apply. The honest answer:

- ❌ Personally identifiable information
- ❌ Health information
- ❌ Financial / payment information
- ❌ Authentication information
- ❌ Personal communications
- ❌ Location
- ❌ Web history
- ❌ User activity
- ❌ Website content (we read it locally to render it, but don't transmit or store it)

### Certifications (the three confirmation checkboxes)

All three apply truthfully — check all three:

1. ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
2. ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
3. ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

> *(Fill in after GitHub Pages is enabled — see `docs/privacy.html` in this repo. URL will be:)*
> `https://cfrazier.github.io/google-drive-markdown-preview/privacy.html`

---

## Graphic assets

### Icon (Store)
- Source: `icons/icon128.png` (already in the repo)
- Chrome uses this as the listing icon

### Screenshots (required: ≥1; recommended: 5)

**Specs**: 1280×800 or 640×400 pixels, PNG or JPG, no padding, full bleed.

**Shot list — capture in this order:**

1. **Before/after split** — Drive showing a `.md` file (e.g., README of a project) with the extension **disabled** on the left half, **enabled** on the right half. This is the strongest hero shot because it shows the actual value in one image.
   - *Practical alternative if a split is hard to compose:* a screenshot of the rendered view alone, with a representative `.md` file open. Pick a file that visibly demonstrates headings, lists, code blocks, and a link — not a wall of paragraphs.

2. **Show Raw toggle** — Same file as #1, but with "Show Raw" clicked so the user can see the raw markdown is preserved and accessible. Include the toggle button visibly in the frame.

3. **Dark theme** — A markdown file rendered in dark mode. Choose content that shows the contrast (code blocks, headings, links).

4. **Multi-file / keyboard nav** — Drive with multiple `.md` files visible (a folder view, with one previewed). Demonstrates the "works with cached previews" feature. Optional.

5. **Popup settings** — The extension's popup open, showing the enable/disable toggle and theme switcher. Frame this so the popup is the focus.

**Capture tips:**
- Use a clean Drive account or folder — no PII, no client filenames.
- Use a representative `.md` file. The repo's own README is a fine demo file.
- Browser window at exactly 1280×800 if possible (use Chrome DevTools → Toggle device toolbar → set custom size).
- If your monitor is high-DPI, take the screenshot at native pixel resolution and scale down — Chrome will reject blurry images.

### Small promo tile (optional but recommended)
- 440×280 pixels
- Same visual style as the icon, with the extension name. Skip if you don't want to design one — the listing works without it.

### Marquee (skip)
- 1400×560. Only matters if Google features you on the homepage. Skip.

---

## Support / homepage URLs (Developer Dashboard fields)

- **Homepage URL**: `https://github.com/cfrazier/google-drive-markdown-preview`
- **Support URL**: `https://github.com/cfrazier/google-drive-markdown-preview/issues`

---

## Submission checklist

Before clicking Submit:

- [ ] `manifest.json` version matches the version of the zip you uploaded
- [ ] Privacy policy URL is live and the page loads
- [ ] All permission justifications copied from above
- [ ] Single purpose declaration copied from above
- [ ] At least one screenshot uploaded at 1280×800
- [ ] Description pasted from above
- [ ] Summary pasted from above (under 132 chars)
- [ ] Category set to Productivity
- [ ] Homepage and Support URLs filled in
- [ ] All three certification checkboxes truthful and checked
- [ ] Data handling: all categories unchecked

---

## Notes

- **First submission review can take days to weeks.** Plan accordingly.
- **Each update goes through review too**, though subsequent reviews tend to be faster.
- **30-day publish window**: once approved, you have 30 days to actually publish or the approval expires.
- **Version bumps must be monotonic.** Don't reset version numbers.
