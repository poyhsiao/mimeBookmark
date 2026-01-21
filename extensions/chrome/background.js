const API_BASE_URL_KEY = 'mimeBookmark_apiBaseUrl';
const API_TOKEN_KEY = 'mimeBookmark_apiToken';

const MENU_ID_SAVE_PAGE = 'mimebookmark-save-page';
const MENU_ID_SAVE_LINK = 'mimebookmark-save-link';
const MENU_ID_SAVE_IMAGE = 'mimebookmark-save-image';
const MENU_ID_OPEN_POPUP = 'mimebookmark-open-popup';
const METADATA_SESSION_KEY = 'mimeBookmark_currentMetadata';
const POPUP_WINDOW_ID_KEY = 'mimeBookmark_popupWindowId';

let currentMetadata = null;
let popupWindowId = null;

// Helper functions for persisting popupWindowId
async function getStoredPopupWindowId() {
  const result = await chrome.storage.session.get(POPUP_WINDOW_ID_KEY);
  return result[POPUP_WINDOW_ID_KEY] || null;
}

async function setStoredPopupWindowId(windowId) {
  popupWindowId = windowId;
  if (windowId !== null) {
    await chrome.storage.session.set({ [POPUP_WINDOW_ID_KEY]: windowId });
  } else {
    await chrome.storage.session.remove(POPUP_WINDOW_ID_KEY);
  }
}

async function clearStoredPopupWindowId() {
  popupWindowId = null;
  await chrome.storage.session.remove(POPUP_WINDOW_ID_KEY);
}

async function validateAndGetPopupWindowId() {
  // First restore from storage if in-memory value is null
  if (popupWindowId === null) {
    popupWindowId = await getStoredPopupWindowId();
  }

  if (popupWindowId === null) {
    return null;
  }

  // Validate that the window still exists
  try {
    await chrome.windows.get(popupWindowId);
    return popupWindowId;
  } catch (e) {
    // Window no longer exists, clear both in-memory and storage
    await clearStoredPopupWindowId();
    return null;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await createContextMenus();

  // Restore popupWindowId from storage on startup
  popupWindowId = await getStoredPopupWindowId();

  // Validate if the window still exists
  if (popupWindowId !== null) {
    try {
      await chrome.windows.get(popupWindowId);
    } catch (e) {
      // Window no longer exists, clear it
      await clearStoredPopupWindowId();
    }
  }

  const apiUrl = await getApiUrl();
  const token = await getToken();

  if (apiUrl && token) {
    console.log('MimeBookmark: Extension configured and ready');
  } else {
    console.log('MimeBookmark: Please configure your API settings in the extension options');
  }
});

async function createContextMenus() {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: MENU_ID_OPEN_POPUP,
    title: 'MimeBookmark',
    contexts: ['all']
  });

  chrome.contextMenus.create({
    id: 'separator-1',
    type: 'separator',
    contexts: ['page', 'link', 'image']
  });

  chrome.contextMenus.create({
    id: MENU_ID_SAVE_PAGE,
    title: 'Save page to MimeBookmark',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: MENU_ID_SAVE_LINK,
    title: 'Save link to MimeBookmark',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: MENU_ID_SAVE_IMAGE,
    title: 'Save image to MimeBookmark',
    contexts: ['image']
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) {
    console.warn('MimeBookmark: Context menu clicked without tab context');
    return;
  }

  switch (info.menuItemId) {
    case MENU_ID_OPEN_POPUP:
      await openPopup(tab.id);
      break;
    case MENU_ID_SAVE_PAGE:
      await savePage(tab.id);
      break;
    case MENU_ID_SAVE_LINK:
      await saveLink(info, tab.id);
      break;
    case MENU_ID_SAVE_IMAGE:
      await saveImage(info, tab.id);
      break;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'save-page':
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        await savePage(activeTab.id);
      }
      break;
    case 'open-popup':
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await openPopup(tab.id);
      }
      break;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'metadataReady':
    case 'metadataUpdated':
      currentMetadata = message.metadata;
      chrome.storage.session.set({ [METADATA_SESSION_KEY]: message.metadata })
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('Failed to save metadata to session storage:', error);
          sendResponse({ success: false });
        });
      return true;

    case 'openPopup':
      openPopup(sender.tab?.id)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getMetadata':
      chrome.storage.session.get(METADATA_SESSION_KEY)
        .then(result => {
          const metadata = result[METADATA_SESSION_KEY] || currentMetadata;
          if (metadata) {
            currentMetadata = metadata;
          }
          sendResponse(metadata);
        })
        .catch(() => sendResponse(currentMetadata));
      return true;

    case 'saveBookmark':
      handleSaveBookmark(message.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;
  }
});

async function openPopup(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }

  if (!tabId) return;

  // Check if popup window already exists using validated persisted value
  const validatedWindowId = await validateAndGetPopupWindowId();
  if (validatedWindowId !== null) {
    // Window exists, focus it and return
    await chrome.windows.update(validatedWindowId, { focused: true });
    return;
  }

  const popupUrl = chrome.runtime.getURL('popup.html');

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script/content-script.js']
    });
  } catch (e) {
    // Content script may already be injected; this is expected and safe to ignore
    console.warn('executeScript failed for tabId', tabId, '- content script may already be loaded:', e.message);
  }

  // Wait for content script to be ready before sending message
  await sendMessageWithRetry(tabId, {
    action: 'openPopup',
    metadata: currentMetadata
  }, 5, 100);

  const popupWindow = await chrome.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 380,
    height: 500,
    focused: true
  });

  // Persist the popup window ID
  await setStoredPopupWindowId(popupWindow.id);
}

// Helper function to send messages with retry logic
async function sendMessageWithRetry(tabId, message, maxRetries = 5, delayMs = 100) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return; // Success, exit
    } catch (e) {
      if (i === maxRetries - 1) {
        // Last attempt failed, log warning but don't throw
        // Tab may be a restricted page (chrome://, etc.)
        console.warn('sendMessage failed after', maxRetries, 'retries for tabId', tabId, ':', e.message);
        return;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function savePage(tabId) {
  const apiUrl = await getApiUrl();
  const token = await getToken();

  if (!apiUrl || !token) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);

    // Always try to read from session storage first
    const sessionData = await chrome.storage.session.get(METADATA_SESSION_KEY);
    let metadata = sessionData[METADATA_SESSION_KEY];

    // Fall back to in-memory or tab data if session storage is empty
    if (!metadata) {
      metadata = currentMetadata || {
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl
      };
    }

    await saveBookmarkToApi(apiUrl, token, {
      url: tab.url,
      title: metadata.title || tab.title,
      description: metadata.description || '',
      tags: [],
      favicon: metadata.favicon || tab.favIconUrl
    });

    showNotification('Bookmark Saved', `Saved "${metadata.title || tab.title}" to MimeBookmark`);

  } catch (error) {
    console.error('Failed to save page:', error);
    showNotification('Save Failed', error.message, true);
  }
}

async function saveLink(info, tabId) {
  const apiUrl = await getApiUrl();
  const token = await getToken();

  if (!apiUrl || !token) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);

    await saveBookmarkToApi(apiUrl, token, {
      url: info.linkUrl,
      title: info.linkText || extractTitleFromUrl(info.linkUrl),
      description: '',
      tags: [],
      favicon: tab.favIconUrl
    });

    showNotification('Bookmark Saved', `Saved link to MimeBookmark`);

  } catch (error) {
    console.error('Failed to save link:', error);
    showNotification('Save Failed', error.message, true);
  }
}

async function saveImage(info, tabId) {
  const apiUrl = await getApiUrl();
  const token = await getToken();

  if (!apiUrl || !token) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);

    const metadata = {
      url: info.srcUrl,
      title: `Image from ${tab.url}`,
      description: '',
      tags: [],
      images: [{
        src: info.srcUrl,
        type: 'image'
      }],
      favicon: tab.favIconUrl
    };

    await saveBookmarkToApi(apiUrl, token, metadata);

    showNotification('Bookmark Saved', `Saved image to MimeBookmark`);

  } catch (error) {
    console.error('Failed to save image:', error);
    showNotification('Save Failed', error.message, true);
  }
}

async function handleSaveBookmark(data) {
  const apiUrl = await getApiUrl();
  const token = await getToken();

  if (!apiUrl || !token) {
    throw new Error('Please configure your API settings');
  }

  const result = await saveBookmarkToApi(apiUrl, token, data);

  return result;
}

async function saveBookmarkToApi(apiUrl, token, bookmarkData) {
  // Normalize apiUrl by removing trailing slash
  const normalizedApiUrl = apiUrl.replace(/\/+$/, '');

  const response = await fetch(`${normalizedApiUrl}/api/bookmarks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bookmarkData)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to save bookmark');
  }

  // Handle empty or non-JSON success responses
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType || !contentType.includes('application/json')) {
    return {};
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function getApiUrl() {
  const result = await chrome.storage.local.get(API_BASE_URL_KEY);
  return result[API_BASE_URL_KEY] || '';
}

async function getToken() {
  const result = await chrome.storage.local.get(API_TOKEN_KEY);
  return result[API_TOKEN_KEY] || '';
}

function showNotification(title, message, isError = false) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL(isError ? 'icons/icon-error-128.png' : 'icons/icon-128.png'),
    title,
    message
  });
}

function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || urlObj.hostname;
    return lastSegment.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
  } catch {
    return url;
  }
}

// Listen for window close events to clear the stored popup window ID
chrome.windows.onRemoved.addListener(async (windowId) => {
  const storedWindowId = await getStoredPopupWindowId();
  if (storedWindowId === windowId) {
    await clearStoredPopupWindowId();
  }
});
