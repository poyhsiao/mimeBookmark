# Chrome Extension Testing Guide

## Overview
This guide provides steps to test the Chrome extension popup functionality with loaded user data.

## Prerequisites

### 1. Load Extension in Chrome
1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in upper right)
4. Click "Load unpacked"
5. Select the extension directory: `[project-root]/extensions/chrome/`
6. Verify the extension appears in the list with the correct icons

### 2. Configure Extension Settings
1. Click the extension card's "Details" button or directly click the extension icon
2. If settings page doesn't open, right-click the extension icon → "Options"
3. In the options page:
   - Enter your API base URL
     - **⚠️ IMPORTANT:** For production, use HTTPS (e.g., `https://api.yourdomain.com`)
     - The `http://localhost:3000` example is for local development only
     - Using HTTP in production exposes tokens to interception
   - Enter your API token (from your user account)
   - Click "Save Settings"
4. Verify save confirmation message appears

## Test Scenarios

### Scenario 1: Verify Extension Icon Displays

**Steps:**
1. Open `chrome://extensions/`
2. Find "MimeBookmark" extension
3. Verify icon appears correctly at all sizes (16px, 32px, 48px, 128px)

**Expected Results:**
- Icon displays correctly in extensions page using 128x128px
- Extension is enabled (not disabled)

---

### Scenario 2: Test Popup with No Authentication

**Steps:**
1. Navigate to any webpage (e.g., `https://example.com`)
2. Click the MimeBookmark extension icon in the toolbar
3. Observe the popup that appears

**Expected Results:**
- Popup title is "Save to MimeBookmark"
- Subtitle is "Quickly save bookmarks from your browser"
- Login form is displayed with:
  - User icon in circle
  - Heading: "Sign in Required"
  - Text: "Please sign in to MimeBookmark to save bookmarks"
  - Button: "Open Settings" with aria-label "Open MimeBookmark settings"
- No bookmark form is visible
- Footer shows no user info

**Accessibility Checks:**
- Tab through popup elements; focus order is logical
- All form controls have visible labels
- Keyboard navigation works with Enter/Space keys
- Screen reader announces proper ARIA roles

---

### Scenario 3: Configure Extension Authentication

**Steps:**
1. From the no-auth popup, click "Open Settings" button
2. Options page opens in new tab
3. Enter API base URL: `http://localhost:3000`
4. Enter API token (you can get this from the app's settings page or generate a token)
5. Click "Save Settings" button

**Expected Results:**
- Settings are saved to Chrome's local storage
- Success message appears
- Settings page can be closed

**Get API Token from the App:**
- Navigate to `http://localhost:3000/settings`
- Find "API Tokens" section
- Generate or copy an existing token
- Paste into extension settings

---

### Scenario 4: Test Popup with Valid Authentication

**Steps:**
1. Configure extension with valid API settings (from Scenario 3)
2. Navigate to any webpage with sufficient content (e.g., `https://developer.chrome.com/docs/extensions/mv3/`)
3. Click the MimeBookmark extension icon
4. Wait for popup to fully load

**Expected Results:**
- **Page Preview Section:**
  - Page title is populated from current tab
  - Page URL is displayed
  - aria-label present: "Current page preview"

- **Title Field:**
  - Title input is pre-filled with current page title
  - User can edit the title

- **Description Field:**
  - Description textarea is empty
  - Placeholder text: "Add a description..."

- **Collection Dropdown:**
  - Select element shows "Select collection..."
  - All user's collections are loaded
  - Collections display correctly in dropdown

- **Tags Input:**
  - Tags input container is empty
  - Placeholder text: "Add tags..."
  - Quick tags appear below with up to 10 popular tags (fetched from API)
  - Clicking a quick tag adds it to the selected tags

- **Action Buttons:**
  - "Cancel" button (secondary style) closes popup
  - "Save Bookmark" button (primary style) is enabled
  - Both buttons have proper aria-labels

- **Footer:**
  - User email is displayed on the left
  - "Open MimeBookmark" link opens dashboard in new tab

**API Calls Made:**
- `GET /api/user/me` - Load user info
- `POST /api/me/sessions` - Register device info (idempotent)
- `GET /api/collections` - Load collections
- `GET /api/tags/popular?limit=10` - Load popular tags

---

### Scenario 5: Test Add Tag Functionality

**Steps:**
1. Open popup with authentication configured
2. Click on the tags input field
3. Type a tag name
4. Press Enter or comma (`,`)

**Expected Results:**
- Tag appears in the tags container with:
  - Purple background (`#f0f4ff`)
  - Purple text (`#667eea`)
  - '×' button to remove
- Tag name appears correctly
- Input field is cleared
- Multiple tags can be added

**Test Tag Scenarios:**
- Add single tag: `javascript`
- Add multiple tags: `javascript`, `programming`, `tutorial`
- Add duplicate tag: Only one instance of each tag name appears
- Remove tag by clicking '×' button
- Remove tag with backspace when input is empty

---

### Scenario 6: Test Save Bookmark Functionality

**Steps:**
1. Populate all fields:
   - Keep or edit the title
   - Add description (optional)
   - Select a collection
   - Add some tags
2. Click "Save Bookmark" button

**Expected Results:**
- Loading state shows:
  - Button text: "Saving..."
  - Status message: "Saving bookmark..." (blue background)
- API call made to `POST /api/bookmarks` with:
  - `url`: Current page URL
  - `title`: From input field
  - `description`: From textarea (can be empty)
  - `collection_id`: ID of selected collection or null
  - `tags`: Array of tag strings
  - `favicon`: Current tab's favicon URL or null
- Success response:
  - Button text: "Saved!"
  - Status message: "Bookmark saved successfully!" (green background)
- Popup automatically closes after 1.5 seconds

**Bookmark Created:**
- Navigate to app dashboard → Bookmarks page
- New bookmark appears with correct:
  - Title
  - URL
  - Description (if provided)
  - Collection (if selected)
  - Tags

---

### Scenario 7: Test Save Bookmark Errors

**Scenario 7a: No Title**
1. Leave title field empty
2. Click "Save Bookmark"

**Expected Results:**
- Error message: "Please enter a title" (red background)
- Popup remains open
- Form fields remain filled

**Scenario 7b: API Not Configured**
1. Navigate to extension options
2. Clear API URL/token values
3. Click "Save"
4. Open popup and click "Save Bookmark"

**Expected Results:**
- Error message: "Please configure your API settings"
- Login form is shown instead of bookmark form

**Scenario 7c: Network Error**
1. Disconnect from internet or set invalid API URL
2. Try to save bookmark

**Expected Results:**
- Error message: "Failed to save bookmark" (red background)
- Button reverts to "Save Bookmark"
- Popup remains open

**Scenario 7d: Invalid or Expired Token**
1. Navigate to extension options
2. Set API token to an invalid or expired value (e.g., "invalid-token-12345")
3. Click "Save Settings"
4. Open popup and try to save a bookmark

**Expected Results:**
- Error message: "Authentication failed. Please check your API token in settings" (red background)
- Login form is shown
- Prompts user to reconfigure settings

**Scenario 7e: API Server Error**
1. Configure extension with valid API URL
2. Stop the API server or set up a proxy to return 500/502/503 responses
3. Open popup and try to save a bookmark

**Expected Results:**
- Error message: "Server error. Please try again later" (red background)
- Button reverts to "Save Bookmark"
- Popup remains open for retry

**Scenario 7f: Rate Limiting**
1. Configure the API server (or use a proxy/mock) to return 429 responses (rate limit exceeded)
2. Open popup and try to save multiple bookmarks quickly

**Expected Results:**
- Error message: "Rate limit exceeded. Please wait and try again" (red background)
- Clear indication of when to retry (if available)
- Button reverts to "Save Bookmark"

---

### Scenario 8: Test Cancel Button

**Steps:**
1. Open popup
2. Fill in some fields
3. Click "Cancel" button

**Expected Results:**
- Popup closes immediately
- No bookmark is created
- Data in popup is not saved

---

### Scenario 9: Test Open MimeBookmark Link

**Steps:**
1. Open popup with authentication
2. Click "Open MimeBookmark" link in footer

**Expected Results:**
- New tab opens with app dashboard/bookmarks page
- Original popup remains open
- Original tab with the webpage remains active

---

### Scenario 10: Test Keyboard Navigation (Accessibility)

**Steps:**
1. Open popup
2. Use Tab key to navigate through all focusable elements
3. Test Enter/Space interaction
4. Use Shift+Tab to navigate backwards

**Expected Results:**
- Focus order is logical and follows visual flow:
  1. Title input
  2. Description textarea
  3. Collection dropdown
  4. Tags input
  5. Quick tag buttons
  6. Cancel button
  7. Save Bookmark button
  8. Open MimeBookmark link
- All interactive elements are focusable
- Focus visible indicator (outline) appears on focused elements
- Enter/Space activates buttons
- Screen reader announces all elements correctly

---

### Scenario 11: Test Popup Closing Behavior

**Test 11a: Click Outside Popup**
1. Click extension icon to open popup
2. Click outside the popup (on a webpage element)

**Expected Results:**
- Popup closes (Chrome's default behavior)

**Test 11b: Press Escape Key**
1. Click extension icon to open popup
2. Press Escape key

**Expected Results:**
- Popup closes (Chrome's default behavior)

**Test 11c: Click Cancel Button**
1. Click extension icon to open popup
2. Click "Cancel" button

**Expected Results:**
- Popup closes (handled by popup.js)

---

### Scenario 12: Test Quick Tags

**Steps:**
1. Open popup with authentication
2. Wait for quick tags to load (up to 10 popular tags)
3. Click on a quick tag button

**Expected Results:**
- Quick tag button appears in list with:
  - Purple background, purple text
  - Hover effect: background becomes purple, text becomes white
  - Focus visible outline when keyboard focused
- Clicking tag adds it to tags container
- Clicked tag remains visible (quick tag buttons are not disabled after clicking)
- Tag can be added multiple times (only one instance in container due to duplicate prevention)

---

### Scenario 13: Test Responsive Behavior

**Steps:**
1. Resize Chrome window to verify popup dimensions
2. Note: Extension popup has fixed width (360px) and minimum height (400px)

**Expected Results:**
- Popup width is always 360px (independent of browser window)
- Popup height adapts to content
- All elements remain visible and accessible
- No horizontal scrolling occurs

---

## Performance Tests

### Test 14: Measure Load Time

**Steps:**
1. Open Chrome DevTools (F12)
2. Enable Network tab
3. Navigate to a webpage
4. Click extension icon
5. Close popup and click extension icon again
6. Measure time until all UI elements are loaded

**Expected Results:**
- Popup appears within 100-200ms
- All fields are loaded within 500ms of opening
- API requests:
  - `/api/user/me`: <1s
  - `/api/collections`: <500ms
  - `/api/tags/popular`: <500ms

---

## Security Tests

### Test 15: Verify Data Stored Securely

**Steps:**
1. Navigate to `chrome://extensions/`
2. Find MimeBookmark extension and click "Service worker" link under "Inspect views" to open DevTools
3. In the DevTools console, run:
   ```javascript
   chrome.storage.local.get(null, console.log)
   ```
4. Verify the output contains `mimeBookmark_apiBaseUrl` and `mimeBookmark_apiToken` keys

**Expected Results:**
- API URL and token are stored in chrome.storage.local
- **Note:** chrome.storage.local is NOT encrypted at rest - data is stored in plaintext on the filesystem
- Sensitive keys like `mimeBookmark_apiToken` are stored as plain text strings
- No sensitive data is exposed in logs or console
- No clear text passwords in any storage

**Security Recommendations:**
- Use short-lived API tokens that expire regularly
- Implement token rotation in your API
- Use HTTPS for production deployments to protect tokens in transit
- Be aware that anyone with access to the user's Chrome profile can extract stored tokens

---

## Regression Tests

### Test 16: Extension Persists Across Sessions

**Steps:**
1. Configure extension with valid API settings
2. Close Chrome completely
3. Reopen Chrome
4. Navigate to a webpage
5. Click extension icon

**Expected Results:**
- Popup opens with authentication loaded
- User email is displayed in footer
- Collections and tags load correctly
- Settings are preserved from previous session

---

## Cleanup and Reset

### Reset Extension Data
1. Open `chrome://extensions/`
2. Find MimeBookmark extension
3. Click "Details"
4. Click "Remove extension"
5. Optionally, clear site data for the application URL

### Clear Extension Storage (if needed)
1. Navigate to `chrome://extensions/`
2. Find MimeBookmark extension and click "Service worker" link under "Inspect views" to open DevTools
3. In the DevTools console, run:
   ```javascript
   chrome.storage.local.clear()
   ```
4. Alternatively, remove and reinstall the extension to clear all data

---

## Test Results Checklist

- [ ] Scenario 1: Extension icon displays correctly
- [ ] Scenario 2: Popup with no authentication
- [ ] Scenario 3: Configure extension authentication
- [ ] Scenario 4: Popup with valid authentication
- [ ] Scenario 5: Add tag functionality
- [ ] Scenario 6: Save bookmark functionality
- [ ] Scenario 7a: Save without title validation
- [ ] Scenario 7b: API not configured error handling
- [ ] Scenario 7c: Network error handling
- [ ] Scenario 7d: Invalid or expired token error handling
- [ ] Scenario 7e: API server error handling
- [ ] Scenario 7f: Rate limiting error handling
- [ ] Scenario 8: Cancel button functionality
- [ ] Scenario 9: Open MimeBookmark link
- [ ] Scenario 10: Keyboard navigation
- [ ] Scenario 11: Popup closing behavior
- [ ] Scenario 12: Quick tags functionality
- [ ] Scenario 13: Responsive behavior
- [ ] Test 14: Performance (load time)
- [ ] Test 15: Data stored securely
- [ ] Test 16: Extension persists across sessions

## Known Limitations

1. **Automated Testing**: Full E2E automation of Chrome extension popups via Playwright is complex and requires browser launcher configuration
2. **Cross-Browser**: Only Chromium-based browsers are supported (Chrome, Edge, Brave, etc.)
3. **Manifest Version**: Extension uses Manifest V3 (required for Chrome Web Store)

## Notes

- Extension uses Chrome's `chrome.storage.local` for settings persistence
- API configuration is per-profile (different Chrome profiles can have different settings)
- Extension requires the hosted application to be running (or API to be accessible via API URL)
- Session device info is sent idempotently; the API handles upserting
- Extension works in Incognito mode if explicitly enabled in extension settings
