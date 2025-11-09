// background.js

// Set default state on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['shareSquad_Users', 'shareSquad_Groups'], (result) => {
    if (!result.shareSquad_Users) {
      chrome.storage.sync.set({ shareSquad_Users: [] });
    }
    if (!result.shareSquad_Groups) {
      chrome.storage.sync.set({ shareSquad_Groups: [] });
    }
  });

  // Set default language preference
  chrome.storage.local.get('shareSquad_Lang', (result) => {
    if (!result.shareSquad_Lang) {
      chrome.storage.local.set({ shareSquad_Lang: 'auto' });
    }
  });
});

// Open the side panel on action click (optional, but good UX)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url) return; // Safety check
  const url = new URL(tab.url);

  if (url.hostname === 'www.notion.so') {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } else {
    // Show a notification if not on Notion
    const notifTitle = chrome.i18n.getMessage('notificationTitle');
    const notifMessage = chrome.i18n.getMessage('notificationMessage');

    // We must use the 'icons/icon128.png' path from the manifest
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: notifTitle,
      message: notifMessage,
      priority: 0
    });
  }
});
