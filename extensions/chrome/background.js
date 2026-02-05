const API_BASE_URL_KEY = 'mimeBookmark_apiBaseUrl';
const API_TOKEN_KEY = 'mimeBookmark_apiToken';

const MENU_ID_SAVE_PAGE = 'mimebookmark-save-page';
const MENU_ID_SAVE_LINK = 'mimebookmark-save-link';
const MENU_ID_SAVE_IMAGE = 'mimebookmark-save-image';
const MENU_ID_OPEN_POPUP = 'mimebookmark-open-popup';
const METADATA_SESSION_KEY = 'mimeBookmark_currentMetadata';
const POPUP_WINDOW_ID_KEY = 'mimeBookmark_popupWindowId';
const MIMEBOOKMARK_STORAGE_KEY = 'mimeBookmark_pageMetadata';

let currentMetadata = null;

const PopupManager = {
  async init() {
    const result = await chrome.storage.session.get(POPUP_WINDOW_ID_KEY);
    popupWindowId = result[POPUP_WINDOW_ID_KEY] || null;

    if (popupWindowId !== null) {
      try {
        await chrome.windows.get(popupWindowId);
      } catch {
        await this.clear();
      }
    }
  },

  async getValidId() {
    if (popupWindowId === null) return null;
    try {
      await chrome.windows.get(popupWindowId);
      return popupWindowId;
    } catch {
      await this.clear();
      return null;
    }
  },

  async set(id) {
    popupWindowId = id;
    await chrome.storage.session.set({ [POPUP_WINDOW_ID_KEY]: id });
  },

  async clear() {
    popupWindowId = null;
    await chrome.storage.session.remove(POPUP_WINDOW_ID_KEY);
  }
};

let popupWindowId = null;

chrome.runtime.onInstalled.addListener(async () => {
  await createContextMenus();
  await PopupManager.init();

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
    case 'save-page': {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        await savePage(activeTab.id);
      }
      break;
    }
    case 'open-popup': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await openPopup(tab.id);
      }
      break;
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'metadataReady':
    case 'metadataUpdated':
      if (message.metadata?.url === sender.tab?.url) {
        currentMetadata = message.metadata;
        chrome.storage.session.set({ [METADATA_SESSION_KEY]: message.metadata })
          .then(() => sendResponse({ success: true }))
          .catch((error) => {
            console.error('Failed to save metadata to session storage:', error);
            sendResponse({ success: false });
          });
      } else {
        sendResponse({ success: false, error: 'Metadata URL mismatch' });
      }
      return true;

    case 'storeMetadata':
      if (message.metadata?.url) {
        chrome.storage.local.set({ [MIMEBOOKMARK_STORAGE_KEY]: message })
          .then(() => sendResponse({ success: true }))
          .catch((error) => {
            console.error('Failed to store metadata:', error);
            sendResponse({ success: false });
          });
      } else {
        sendResponse({ success: false, error: 'Invalid metadata' });
      }
      return true;

    case 'getStoredMetadata':
      chrome.storage.local.get(MIMEBOOKMARK_STORAGE_KEY)
        .then((result) => {
          const stored = result[MIMEBOOKMARK_STORAGE_KEY];
          if (stored) {
            const oneHour = 60 * 60 * 1000;
            if (Date.now() - stored.timestamp < oneHour && stored.url === message.url) {
              sendResponse({ metadata: stored.metadata });
              return;
            }
          }
          sendResponse({ metadata: null });
        })
        .catch((error) => {
          console.error('Failed to retrieve stored metadata:', error);
          sendResponse({ metadata: null });
        });
      return true;

    case 'clearStoredMetadata':
      chrome.storage.local.remove(MIMEBOOKMARK_STORAGE_KEY)
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('Failed to clear stored metadata:', error);
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
        .then(async (result) => {
          let metadata = result[METADATA_SESSION_KEY];
          if (metadata && sender.tab?.url && metadata.url !== sender.tab.url) {
            metadata = null;
          }
          if (metadata) {
            currentMetadata = metadata;
          }
          sendResponse(metadata || null);
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

  const validatedWindowId = await PopupManager.getValidId();
  if (validatedWindowId !== null) {
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
    console.warn('executeScript failed for tabId', tabId, '- content script may already be loaded:', e.message);
  }

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

  await PopupManager.set(popupWindow.id);
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

async function getConfiguredApiOrOpenOptions({ openOptionsOnMissing = true } = {}) {
  const [apiUrl, token] = await Promise.all([getApiUrl(), getToken()]);

  if (!apiUrl || !token) {
    if (openOptionsOnMissing) {
      await chrome.runtime.openOptionsPage();
      return null;
    }
    throw new Error('Please configure your API settings');
  }

  return { apiUrl, token };
}

async function saveWithPayload(tabId, buildPayload, successMessage) {
  const config = await getConfiguredApiOrOpenOptions();
  if (!config) return;
  const { apiUrl, token } = config;

  try {
    const tab = await chrome.tabs.get(tabId);
    const payload = await buildPayload({ tab });
    await saveBookmarkToApi(apiUrl, token, payload);
    showNotification('Bookmark Saved', successMessage(payload, tab));
  } catch (error) {
    console.error('Failed to save bookmark:', error);
    showNotification('Save Failed', error.message, true);
  }
}

async function savePage(tabId) {
  await saveWithPayload(
    tabId,
    async ({ tab }) => {
      const sessionData = await chrome.storage.session.get(METADATA_SESSION_KEY);
      let metadata = sessionData[METADATA_SESSION_KEY];

      if (!metadata || metadata.url !== tab.url) {
        metadata = currentMetadata || {
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl
        };
      }

      return {
        url: tab.url,
        title: metadata.title || tab.title,
        description: metadata.description || '',
        tags: [],
        favicon: metadata.favicon || tab.favIconUrl
      };
    },
    (payload, tab) => `Saved "${payload.title || tab.title}" to MimeBookmark`
  );
}

async function saveLink(info, tabId) {
  await saveWithPayload(
    tabId,
    async ({ tab }) => ({
      url: info.linkUrl,
      title: info.linkText || extractTitleFromUrl(info.linkUrl),
      description: '',
      tags: [],
      favicon: tab.favIconUrl
    }),
    () => 'Saved link to MimeBookmark'
  );
}

async function saveImage(info, tabId) {
  await saveWithPayload(
    tabId,
    async ({ tab }) => ({
      url: info.srcUrl,
      title: `Image from ${tab.url}`,
      description: '',
      tags: [],
      images: [{ src: info.srcUrl, type: 'image' }],
      favicon: tab.favIconUrl
    }),
    () => 'Saved image to MimeBookmark'
  );
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
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
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
  if (windowId === popupWindowId) {
    await PopupManager.clear();
  }
});
