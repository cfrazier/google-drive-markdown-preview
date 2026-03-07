chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      enabled: true,
      theme: 'light'
    });
  }
});

// Detect SPA navigations within Google Drive (replaces broad MutationObserver in content script).
// Track last URL per tab to suppress duplicate events — Drive fires onHistoryStateUpdated
// multiple times for the same URL during a single navigation.
const _lastNavUrl = new Map();

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId === 0) {
      const prev = _lastNavUrl.get(details.tabId);
      if (prev === details.url) return;
      _lastNavUrl.set(details.tabId, details.url);

      chrome.tabs.sendMessage(details.tabId, {
        action: 'navigationChanged',
        url: details.url
      }).catch(() => {
        // Content script not loaded yet, ignore
      });
    }
  },
  { url: [{ hostEquals: 'drive.google.com' }] }
);

// Clean up tracking when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  _lastNavUrl.delete(tabId);
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getSettings':
      chrome.storage.sync.get(['enabled', 'theme'], (result) => {
        sendResponse(result);
      });
      return true;

    case 'updateSettings':
      chrome.storage.sync.set(request.settings, () => {
        chrome.tabs.query({url: "https://drive.google.com/*"}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'settingsChanged',
              settings: request.settings
            }).catch(() => {});
          });
        });
        sendResponse({success: true});
      });
      return true;

    default:
      sendResponse({error: 'Unknown action'});
  }
});
