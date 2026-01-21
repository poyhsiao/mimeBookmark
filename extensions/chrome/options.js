const API_BASE_URL_KEY = 'mimeBookmark_apiBaseUrl';
const API_TOKEN_KEY = 'mimeBookmark_apiToken';
const AUTO_FILL_TITLE_KEY = 'mimeBookmark_autoFillTitle';
const AUTO_FETCH_FAVICON_KEY = 'mimeBookmark_autoFetchFavicon';
const DEFAULT_COLLECTION_KEY = 'mimeBookmark_defaultCollection';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  await loadCollections();
  updateShortcutKeys();

  // Attach event listeners after DOM is ready
  const apiUrlElement = document.getElementById('apiUrl');
  const apiTokenElement = document.getElementById('apiToken');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');

  if (apiUrlElement) {
    apiUrlElement.addEventListener('change', async () => {
      const apiUrl = document.getElementById('apiUrl').value.trim();
      const token = document.getElementById('apiToken').value.trim();

      if (apiUrl && token) {
        await loadCollections();
      }
    });
  }

  if (apiTokenElement) {
    apiTokenElement.addEventListener('change', async () => {
      const apiUrl = document.getElementById('apiUrl').value.trim();
      const token = document.getElementById('apiToken').value.trim();

      if (apiUrl && token) {
        await loadCollections();
      }
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }

  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', testConnection);
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', clearData);
  }
}

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    API_BASE_URL_KEY,
    API_TOKEN_KEY,
    AUTO_FILL_TITLE_KEY,
    AUTO_FETCH_FAVICON_KEY,
    DEFAULT_COLLECTION_KEY
  ]);

  const apiUrlEl = document.getElementById('apiUrl');
  const apiTokenEl = document.getElementById('apiToken');
  const autoFillTitleEl = document.getElementById('autoFillTitle');
  const autoFetchFaviconEl = document.getElementById('autoFetchFavicon');
  const defaultCollectionEl = document.getElementById('defaultCollection');

  if (apiUrlEl && settings[API_BASE_URL_KEY]) {
    apiUrlEl.value = settings[API_BASE_URL_KEY];
  }

  if (apiTokenEl && settings[API_TOKEN_KEY]) {
    apiTokenEl.value = settings[API_TOKEN_KEY];
  }

  if (autoFillTitleEl) {
    autoFillTitleEl.checked = settings[AUTO_FILL_TITLE_KEY] !== false;
  }

  if (autoFetchFaviconEl) {
    autoFetchFaviconEl.checked = settings[AUTO_FETCH_FAVICON_KEY] !== false;
  }

  if (defaultCollectionEl && settings[DEFAULT_COLLECTION_KEY]) {
    defaultCollectionEl.value = settings[DEFAULT_COLLECTION_KEY];
  }
}

async function loadCollections() {
  const apiUrlEl = document.getElementById('apiUrl');
  const apiTokenEl = document.getElementById('apiToken');

  if (!apiUrlEl || !apiTokenEl) {
    return;
  }

  const apiUrl = apiUrlEl.value.trim();
  const token = apiTokenEl.value.trim();

  if (!apiUrl || !token) {
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/api/collections`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch collections');
    }

    const data = await response.json();
    const select = document.getElementById('defaultCollection');

    if (!select) {
      return;
    }

    const currentValue = select.value;
    select.innerHTML = '<option value="">No default collection</option>';

    // Validate that we have an array
    const collections = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

    if (collections.length > 0) {
      collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = collection.name;
        select.appendChild(option);
      });
    } else {
      console.warn('No collections found or invalid response format');
    }

    if (currentValue) {
      select.value = currentValue;
    }

  } catch (error) {
    console.error('Failed to load collections:', error);
  }
}

async function saveSettings() {
  const apiUrlEl = document.getElementById('apiUrl');
  const apiTokenEl = document.getElementById('apiToken');
  const autoFillTitleEl = document.getElementById('autoFillTitle');
  const autoFetchFaviconEl = document.getElementById('autoFetchFavicon');
  const defaultCollectionEl = document.getElementById('defaultCollection');

  // Validate required elements exist
  if (!apiUrlEl || !apiTokenEl || !autoFillTitleEl || !autoFetchFaviconEl || !defaultCollectionEl) {
    console.error('Required form elements not found');
    showStatus('Settings form error. Please refresh the page.', 'error');
    return;
  }

  const apiUrl = apiUrlEl.value.trim();
  const token = apiTokenEl.value.trim();
  const autoFillTitle = autoFillTitleEl.checked;
  const autoFetchFavicon = autoFetchFaviconEl.checked;
  const defaultCollection = defaultCollectionEl.value;

  if (!apiUrl) {
    showStatus('Please enter your MimeBookmark URL', 'error');
    return;
  }

  try {
    new URL(apiUrl);
  } catch {
    showStatus('Please enter a valid URL', 'error');
    return;
  }

  await chrome.storage.local.set({
    [API_BASE_URL_KEY]: apiUrl,
    [API_TOKEN_KEY]: token,
    [AUTO_FILL_TITLE_KEY]: autoFillTitle,
    [AUTO_FETCH_FAVICON_KEY]: autoFetchFavicon,
    [DEFAULT_COLLECTION_KEY]: defaultCollection
  });

  showStatus('Settings saved successfully!', 'success');

  if (apiUrl && token) {
    await loadCollections();
  }
}

async function testConnection() {
  const apiUrlEl = document.getElementById('apiUrl');
  const apiTokenEl = document.getElementById('apiToken');

  if (!apiUrlEl || !apiTokenEl) {
    showStatus('Please enter your API settings', 'error');
    return;
  }

  const apiUrl = apiUrlEl.value.trim();
  const token = apiTokenEl.value.trim();

  if (!apiUrl) {
    showStatus('Please enter your MimeBookmark URL', 'error');
    return;
  }

  showStatus('Testing connection...', 'loading');

  try {
    new URL(apiUrl);
  } catch {
    showStatus('Please enter a valid URL', 'error');
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(`${apiUrl}/api/user/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const user = await response.json();
    showStatus(`Connected as ${user.email || 'User'}`, 'success');

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Connection test failed:', error);

    if (error.name === 'AbortError') {
      showStatus('Connection timed out', 'error');
    } else {
      showStatus(error.message || 'Connection failed. Please check your settings.', 'error');
    }
  }
}

async function clearData() {
  const confirmed = confirm('Are you sure you want to clear all extension data? This will remove your API settings and cannot be undone.');

  if (!confirmed) {
    return;
  }

  const doubleConfirmed = confirm('This will disconnect the extension from MimeBookmark. Are you absolutely sure?');

  if (!doubleConfirmed) {
    return;
  }

  await chrome.storage.local.clear();

  const apiUrlEl = document.getElementById('apiUrl');
  const apiTokenEl = document.getElementById('apiToken');
  const autoFillTitleEl = document.getElementById('autoFillTitle');
  const autoFetchFaviconEl = document.getElementById('autoFetchFavicon');
  const defaultCollectionEl = document.getElementById('defaultCollection');

  if (apiUrlEl) apiUrlEl.value = '';
  if (apiTokenEl) apiTokenEl.value = '';
  if (autoFillTitleEl) autoFillTitleEl.checked = true;
  if (autoFetchFaviconEl) autoFetchFaviconEl.checked = true;
  if (defaultCollectionEl) defaultCollectionEl.value = '';

  showStatus('All extension data has been cleared', 'success');
}

async function updateShortcutKeys() {
  // Get actual shortcuts from Chrome
  const commands = await chrome.commands.getAll();

  // Detect platform using modern API with fallback
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toString();
  const isMac = platform.toUpperCase().includes('MAC');
  const modifier = isMac ? 'Cmd' : 'Ctrl';

  // Find the save-page command
  const savePageCommand = commands.find(cmd => cmd.name === 'save-page');
  const openPopupCommand = commands.find(cmd => cmd.name === 'open-popup');

  // Update all shortcut key displays
  const shortcutItems = document.querySelectorAll('.shortcut-item');
  shortcutItems.forEach(item => {
    const shortcutName = item.querySelector('.shortcut-name');
    const shortcutKeys = item.querySelector('.shortcut-keys');

    if (!shortcutName || !shortcutKeys) return;

    // Update based on the command name
    if (shortcutName.textContent.includes('Save current page') && savePageCommand?.shortcut) {
      updateShortcutDisplay(shortcutKeys, savePageCommand.shortcut, modifier);
    } else if (shortcutName.textContent.includes('Open popup') && openPopupCommand?.shortcut) {
      updateShortcutDisplay(shortcutKeys, openPopupCommand.shortcut, modifier);
    } else {
      // Fallback: just update Ctrl to platform modifier
      const keyElements = item.querySelectorAll('.key');
      keyElements.forEach(keyEl => {
        if (keyEl.textContent === 'Ctrl') {
          keyEl.textContent = modifier;
        }
      });
    }
  });
}

function updateShortcutDisplay(container, shortcut, modifier) {
  // Parse the shortcut string (e.g., "Ctrl+Shift+D" or "Command+Shift+D")
  const keys = shortcut.split('+').map(k => k.trim());

  // Replace generic modifiers with platform-specific ones
  const displayKeys = keys.map(key => {
    if (key === 'Ctrl' || key === 'Control') return modifier;
    if (key === 'Command' || key === 'Meta') return 'Cmd';
    return key;
  });

  // Clear and rebuild the shortcut display
  container.innerHTML = '';
  displayKeys.forEach(key => {
    const span = document.createElement('span');
    span.className = 'key';
    span.textContent = key;
    container.appendChild(span);
  });
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');

  // Early return if status element doesn't exist
  if (!statusEl) {
    console.warn('Status element not found');
    return;
  }

  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  setTimeout(() => {
    if (statusEl) {
      statusEl.className = 'status';
    }
  }, 3000);
}
