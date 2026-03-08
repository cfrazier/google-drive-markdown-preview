# Google Drive Markdown Preview

A Chrome extension that automatically detects and renders markdown files in Google Drive's preview mode, replacing raw markdown text with beautifully formatted HTML.

## Features

- **Automatic Detection**: Detects `.md` files when previewed in Google Drive
- **Seamless Rendering**: Converts markdown to properly formatted HTML in-place
- **Toggle View**: Switch between rendered markdown and raw text with a single click
- **GitHub-style Styling**: Clean, readable formatting with syntax highlighting support
- **Dark Theme Support**: Automatically adapts to system dark mode preferences
- **Multi-file Support**: Handle multiple markdown files in the same session
- **No External Dependencies**: All processing happens locally in your browser

## Installation

### From Chrome Web Store (Recommended)
*Coming soon - extension will be published to Chrome Web Store*

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension will be installed and ready to use

## Usage

1. **Open Google Drive** in your Chrome browser
2. **Double-click any `.md` file** to open it in preview mode
3. **Watch the magic happen** - the extension automatically detects and renders the markdown
4. **Use the toggle button** (top-right of rendered content) to switch between formatted and raw views
5. **Adjust settings** by clicking the extension icon in your browser toolbar

## Supported Markdown Features

- **Headers** (H1-H6) with proper hierarchy
- **Text Formatting**: Bold, italic, strikethrough
- **Lists**: Ordered and unordered lists with nesting
- **Links and Images**: Clickable links and embedded images
- **Code**: Inline code and fenced code blocks
- **Tables**: Full table support with styling
- **Blockquotes**: Styled quote blocks
- **Horizontal Rules**: Section dividers

## Settings

Click the extension icon in your toolbar to access:

- **Enable/Disable**: Toggle the extension on/off
- **Theme Selection**: Choose between light and dark themes
- **Status Information**: See if you're on a compatible Google Drive page

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: Only requires access to Google Drive pages
- **Privacy**: No data collection - all processing happens locally
- **Performance**: Event-driven MutationObserver architecture — zero polling, zero timeouts
- **Compatibility**: Works with all Chromium-based browsers (Chrome, Edge, Brave, etc.)

## Development

This extension uses:
- **Content Scripts**: Injected into Google Drive pages for file detection
- **Marked.js**: Markdown parsing and HTML conversion
- **CSS Styling**: GitHub-inspired markdown formatting
- **Chrome Storage API**: User preferences and settings

For development setup and architecture details, see [CLAUDE.md](CLAUDE.md).

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Microsoft Edge 88+
- ✅ Brave Browser
- ✅ Other Chromium-based browsers

## Privacy & Security

- **No Data Collection**: Extension doesn't collect, store, or transmit any personal data
- **Local Processing**: All markdown rendering happens in your browser
- **Minimal Permissions**: Only requests access to Google Drive pages
- **Safe Rendering**: HTML output is properly sanitized

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push and create a pull request

## Troubleshooting

**Extension not working?**
- Make sure you're on `drive.google.com`
- Try refreshing the Google Drive page
- Check that the extension is enabled in `chrome://extensions/`

**Markdown not rendering?**
- Ensure the file has a `.md` extension
- Try double-clicking the file again
- Check the extension popup for status information

**Performance issues?**
- Disable other Chrome extensions temporarily to test
- Clear browser cache and cookies for Google Drive

## Credits

- Markdown icon by [Font Awesome](https://fontawesome.com) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- Markdown parsing by [marked.js](https://github.com/markedjs/marked) (MIT)
- HTML sanitization by [DOMPurify](https://github.com/cure53/DOMPurify) (Apache 2.0 / MPL 2.0)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### Version 1.1.0
- Production-ready release
- Optimized performance and polling mechanism
- Enhanced multi-file support
- Improved reliability and error handling
- Clean, production-ready codebase

### Version 1.0.0
- Initial release
- Basic markdown detection and rendering
- Toggle between raw and formatted views
- Settings popup interface

---

**Made with ❤️ for the markdown community**

*Star this repository if you find it useful!*