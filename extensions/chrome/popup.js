let currentTab = null;
let tags = [];
let collections = [];
let userInfo = null;

const API_BASE_URL_KEY = 'mimeBookmark_apiBaseUrl';
const API_TOKEN_KEY = 'mimeBookmark_apiToken';

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    currentTab = null;
    document.getElementById('pageTitle').textContent = 'Untitled';
    document.getElementById('pageUrl').textContent = '';
    document.getElementById('title').value = '';
    showLoginRequired();
    return;
  }

  currentTab = tab;

  document.getElementById('pageTitle').textContent = tab.title || 'Untitled';
  document.getElementById('pageUrl').textContent = tab.url || '';
  document.getElementById('title').value = tab.title || '';

  const result = await chrome.storage.local.get([API_BASE_URL_KEY, API_TOKEN_KEY]);

  if (result[API_BASE_URL_KEY] && result[API_TOKEN_KEY]) {
    await loadUserData();
  } else {
    showLoginRequired();
  }

  setupTagsInput();

  // Attach event listeners
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const saveBtn = document.getElementById('saveBtn');
  const openMimeBookmarkLink = document.getElementById('openMimeBookmarkLink');

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', openOptions);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closePopup);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', saveBookmark);
  }

  if (openMimeBookmarkLink) {
    openMimeBookmarkLink.addEventListener('click', (e) => {
      e.preventDefault();
      openMimeBookmark();
    });
  }
}

function showLoginRequired() {
  document.getElementById('loginRequired').style.display = 'block';
  document.getElementById('bookmarkForm').style.display = 'none';
}

async function loadUserData() {
  const apiUrl = await getApiUrl();
  const token = await getToken();

  if (!apiUrl || !token) {
    showLoginRequired();
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
      throw new Error('Failed to fetch user data');
    }

    userInfo = await response.json();
    document.getElementById('userInfo').textContent = userInfo.email || 'Signed in';

    await loadCollections(apiUrl, token);
    await loadQuickTags(apiUrl, token);

    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('bookmarkForm').style.display = 'block';

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('User data fetch timed out');
    } else {
      console.error('Failed to load user data:', error);
    }
    showLoginRequired();
  }
}

async function loadCollections(apiUrl, token) {
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
    const items = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

    collections = items;
    const select = document.getElementById('collection');
    select.innerHTML = '<option value="">Select collection...</option>';

    if (items.length === 0) {
      console.error('No collections returned or unexpected response shape');
    }

    items.forEach(collection => {
      const option = document.createElement('option');
      option.value = collection.id;
      option.textContent = collection.name;
      select.appendChild(option);
    });

  } catch (error) {
    console.error('Failed to load collections:', error);
    const select = document.getElementById('collection');
    select.innerHTML = '<option value="">Failed to load collections</option>';
  }
}

async function loadQuickTags(apiUrl, token) {
  try {
    const response = await fetch(`${apiUrl}/api/tags/popular?limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch popular tags');
    }

    const popularTags = await response.json();
    const quickTagsContainer = document.getElementById('quickTags');
    quickTagsContainer.innerHTML = '';

    // Validate popularTags is an array before slicing/iterating
    const popularTagsList = Array.isArray(popularTags) ? popularTags : [];
    popularTagsList.slice(0, 8).forEach(tag => {
      const button = document.createElement('button');
      button.className = 'quick-tag';
      button.textContent = tag.name;
      button.onclick = () => addTag(tag.name);
      quickTagsContainer.appendChild(button);
    });

  } catch (error) {
    console.error('Failed to load popular tags:', error);
  }
}

function setupTagsInput() {
  const input = document.getElementById('tagsInput');
  const container = document.getElementById('tagsContainer');

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.value.trim();
      if (value && !tags.includes(value)) {
        addTag(value);
        input.value = '';
      }
    } else if (e.key === 'Backspace' && !input.value && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  });

  container.addEventListener('click', () => {
    input.focus();
  });
}

function addTag(tagName) {
  if (tags.includes(tagName)) return;

  tags.push(tagName);
  renderTags();
}

function removeTag(tagName) {
  tags = tags.filter(t => t !== tagName);
  renderTags();
}

function renderTags() {
  const container = document.getElementById('tagsContainer');
  const input = document.getElementById('tagsInput');

  const existingTags = container.querySelectorAll('.tag');
  existingTags.forEach(tag => tag.remove());

  tags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';

    // Safely add tag text
    const tagText = document.createTextNode(tag);
    tagEl.appendChild(tagText);

    // Create button safely
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', `Remove ${tag}`);
    removeBtn.addEventListener('click', () => removeTag(tag));

    tagEl.appendChild(removeBtn);
    container.insertBefore(tagEl, input);
  });
}

async function saveBookmark() {
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const collectionId = document.getElementById('collection').value;

  if (!title) {
    showStatus('Please enter a title', 'error');
    return;
  }

  if (!currentTab || !currentTab.url) {
    showStatus('Unable to save bookmark: no active tab', 'error');
    return;
  }

  const apiUrl = await getApiUrl();
  const token = await getToken();

  if (!apiUrl || !token) {
    showStatus('Please configure your API settings', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  showStatus('Saving bookmark...', 'loading');

  try {
    const response = await fetch(`${apiUrl}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: currentTab.url,
        title,
        description,
        collection_id: collectionId || null,
        tags,
        favicon: currentTab.favIconUrl || null
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to save bookmark');
    }

    const contentType = response.headers.get('content-type');
    if (response.status !== 204 && contentType && contentType.includes('application/json')) {
      await response.json().catch(() => ({}));
    }
    showStatus('Bookmark saved successfully!', 'success');
    saveBtn.textContent = 'Saved!';

    setTimeout(() => {
      closePopup();
    }, 1500);

  } catch (error) {
    console.error('Failed to save bookmark:', error);
    showStatus(error.message || 'Failed to save bookmark', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Bookmark';
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

async function getApiUrl() {
  const result = await chrome.storage.local.get(API_BASE_URL_KEY);
  return result[API_BASE_URL_KEY] || '';
}

async function getToken() {
  const result = await chrome.storage.local.get(API_TOKEN_KEY);
  return result[API_TOKEN_KEY] || '';
}

function closePopup() {
  window.close();
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function openMimeBookmark() {
  const result = await chrome.storage.local.get(API_BASE_URL_KEY);
  const apiUrl = result[API_BASE_URL_KEY];
  if (apiUrl) {
    chrome.tabs.create({ url: `${apiUrl}/dashboard/bookmarks` });
  } else {
    chrome.runtime.openOptionsPage();
  }
}

document.addEventListener('DOMContentLoaded', init);
