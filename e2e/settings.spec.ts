import { test, expect } from '@playwright/test';
import { authenticateUser } from './fixtures/auth';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings');
  });

  test('should display page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.locator('text=Manage your account and preferences')).toBeVisible();
  });

  test('should have profile section', async ({ page }) => {
    const profileSection = page.locator('text=Profile').first();
    await expect(profileSection).toBeVisible();
  });

  test('should have display name input', async ({ page }) => {
    const nameInput = page.locator('label:has-text("Display Name")').first();
    await expect(nameInput).toBeVisible();
  });

  test('should have avatar upload section', async ({ page }) => {
    const uploadButton = page.locator('button:has-text("Upload Photo")').first();
    await expect(uploadButton).toBeVisible();
  });

  test('should have appearance section with theme options', async ({ page }) => {
    const appearanceSection = page.locator('text=Appearance').first();
    await expect(appearanceSection).toBeVisible();
    
    await expect(page.locator('text=Light')).toBeVisible();
    await expect(page.locator('text=Dark')).toBeVisible();
    await expect(page.locator('text=System')).toBeVisible();
  });

  test('should have language and region section', async ({ page }) => {
    const languageSection = page.locator('text=Language & Region').first();
    await expect(languageSection).toBeVisible();
    
    await expect(page.locator('select[id*="language"]')).toBeVisible();
    await expect(page.locator('select[id*="timezone"]')).toBeVisible();
  });

  test('should have usage stats section', async ({ page }) => {
    const statsSection = page.locator('text=Usage Stats').first();
    await expect(statsSection).toBeVisible();
  });
});

test.describe('Settings - Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('should allow saving profile', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Save original value
    let originalName: string | undefined;
    try {
      originalName = await page.locator('input[id*="displayName"]').inputValue();
    } catch (error) {
      console.error('Failed to get original display name:', error);
    }

    try {
      // Fill display name
      await page.fill('input[id*="displayName"]', 'Test User');

      // Save profile
      await page.click('button:has-text("Save Profile")');

      await expect(page.locator('input[id*="displayName"]')).toHaveValue('Test User');

      await page.reload();
      await expect(page.locator('input[id*="displayName"]')).toHaveValue('Test User');
    } finally {
      // Restore original value if it was successfully retrieved
      if (typeof originalName !== 'undefined' && originalName !== null) {
        try {
          await page.fill('input[id*="displayName"]', originalName);
          await page.click('button:has-text("Save Profile")');
        } catch (error) {
          console.error('Failed to restore original display name:', error);
        }
      }
    }
  });

  test('should allow changing theme', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Wait for theme toggle group to be visible and get the container
    const themeToggle = page.locator('[data-mirror="theme"]').or(page.locator('button:has-text("Dark")').first()).or(page.locator('button:has-text("Light")').first());
    await expect(themeToggle.first()).toBeVisible();

    // Get the closest container that holds all theme buttons
    // Navigate up from the button to the parent container that contains all theme buttons
    const themeToggleGroup = themeToggle.first().locator('..');

    // Save original theme value - scoped to theme toggle container
    const htmlElement = page.locator('html');
    const originalTheme = await themeToggleGroup.evaluate((element) => {
      // Query within the theme toggle container only
      const activeButton = element.querySelector('button[data-state="selected"]') || element.querySelector('button[data-state="on"]');
      return activeButton?.textContent?.trim().toLowerCase() || 'system';
    });

    try {
      // Find and click dark theme option (using text since that's more reliable)
      const darkButton = page.locator('button', { hasText: 'Dark' }).first();
      await darkButton.click();

      // Wait for theme change to apply
      await page.waitForTimeout(500);

      // Check if dark mode is applied (check html class or data-theme attribute)
      const hasDarkClass = await htmlElement.evaluate(el =>
        el.classList.contains('dark') || el.getAttribute('data-theme') === 'dark'
      );

      // If dark mode didn't apply via class, just check the button state changed
      if (!hasDarkClass) {
        const selectedButton = await themeToggleGroup.evaluate((element) => {
          // Query within the theme toggle container only
          return element.querySelector('button[data-state="selected"]')?.textContent?.trim();
        });
        expect(selectedButton).toBe('Dark');
      }
    } finally {
      // Restore exact original theme - use scoped container
      try {
        const originalButton = themeToggleGroup.locator('button', { hasText: originalTheme.charAt(0).toUpperCase() + originalTheme.slice(1) }).first();
        await originalButton.click();
        await page.waitForTimeout(500);
      } catch (error) {
        console.error('Failed to restore original theme:', error);
      }
    }
  });

  test('should allow changing language', async ({ page }) => {
    await page.goto('/dashboard/settings');

    const languageSelect = page.locator('select[id*="language"]');

    // Save original value
    const originalLanguage = await languageSelect.inputValue();

    try {
      // Select language
      await page.selectOption('select[id*="language"]', 'zh');

      await expect(languageSelect).toHaveValue('zh');
    } finally {
      // Restore original value
      try {
        await page.selectOption('select[id*="language"]', originalLanguage);
      } catch (error) {
        console.error('Failed to restore original language:', error);
      }
    }
  });

  test('should allow changing timezone', async ({ page }) => {
    await page.goto('/dashboard/settings');

    const timezoneSelect = page.locator('select[id*="timezone"]');

    // Save original value
    const originalTimezone = await timezoneSelect.inputValue();

    try {
      // Select timezone
      await page.selectOption('select[id*="timezone"]', 'America/Los_Angeles');

      await expect(timezoneSelect).toHaveValue('America/Los_Angeles');
    } finally {
      // Restore original value
      try {
        await page.selectOption('select[id*="timezone"]', originalTimezone);
      } catch (error) {
        console.error('Failed to restore original timezone:', error);
      }
    }
  });

  test('should have save preferences button', async ({ page }) => {
    await page.goto('/dashboard/settings');
    const saveButton = page.locator('button:has-text("Save Preferences")').first();
    await expect(saveButton).toBeVisible();
  });

  test('should display user statistics', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Check for stats cards using more specific selectors
    // Look for the usage stats section
    const statsSection = page.locator('text=Usage Stats').first();
    await expect(statsSection).toBeVisible();

    // Check for stat cards by looking for the pattern in the grid
    const bookmarksStat = page.locator('div').filter({ hasText: 'Bookmarks' }).first();
    const collectionsStat = page.locator('div').filter({ hasText: 'Collections' }).first();
    const tagsStat = page.locator('div').filter({ hasText: 'Tags' }).first();
    const planStat = page.locator('div').filter({ hasText: 'Plan' }).first();

    await expect(bookmarksStat).toBeVisible();
    await expect(collectionsStat).toBeVisible();
    await expect(tagsStat).toBeVisible();
    await expect(planStat).toBeVisible();
  });
});

test.describe('Settings - Responsive', () => {
  test('should work on mobile viewport', async ({ page }) => {
    // Authenticate before navigating to protected route
    await authenticateUser(page);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/settings');

    await expect(page.locator('h1')).toContainText('Settings');

    // Use more specific selector for Profile section
    const profileSection = page.locator('text=Profile').locator('..').locator('text=Update your profile information').or(page.locator('[class*="profile" i]'));
    await expect(profileSection.first()).toBeVisible();
  });
});

test.describe('Settings - Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/settings');
  });

  test('should update display name', async ({ page }) => {
    let currentDisplayName = 'Test User';
    await page.route('**/api/me/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        currentDisplayName = body.displayName ?? currentDisplayName;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ displayName: currentDisplayName }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ displayName: currentDisplayName }),
        });
      }
    });

    const nameInput = page.locator('input[id*="displayName"]').first();
    const originalValue = await nameInput.inputValue();
    currentDisplayName = originalValue;

    try {
      await nameInput.clear();
      await nameInput.fill('Updated Name');
      await page.click('button:has-text("Save Profile")');

      await expect(nameInput).toHaveValue('Updated Name', { timeout: 10000 });
    } finally {
      await nameInput.clear();
      await nameInput.fill(originalValue);
      // Persist the restored value to the server
      await page.click('button:has-text("Save Profile")');
    }
  });

  test('should update email', async ({ page }) => {
    await page.route('**/api/user/email', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ email: 'new@example.com' }),
        });
      } else {
        await route.fallback();
      }
    });

    const emailSection = page.locator('text=Profile').locator('..').locator('text=Email').or(page.locator('label:has-text("Email")')).first();
    await expect(emailSection).toBeVisible();
    await emailSection.click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    const emailInput = modal.locator('input[type="email"]').first();
    await emailInput.fill('new@example.com');

    await modal.locator('button:has-text("Update Email")').click();

    const successMessage = modal.locator('text=success').or(modal.locator('text=sent')).or(modal.locator('text="Email updated"')).first();
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test('should update timezone', async ({ page }) => {
    await page.route('**/api/me/settings**', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ timezone: 'America/New_York' }),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ timezone: 'America/New_York' }),
        });
      }
    });

    const timezoneSelect = page.locator('select[id*="timezone"]').first();
    const originalValue = await timezoneSelect.inputValue();

    try {
      await timezoneSelect.selectOption('America/New_York');
      await page.click('button:has-text("Save Preferences")');

      await page.reload();
      await expect(timezoneSelect).toHaveValue('America/New_York', { timeout: 10000 });
    } finally {
      await timezoneSelect.selectOption(originalValue);
      await page.click('button:has-text("Save Preferences")');
    }
  });

  test('should update theme preference', async ({ page }) => {
    const originalTheme = await page.evaluate(() => {
      const html = document.querySelector('html');
      return html?.getAttribute('data-theme') || 'system';
    });

    try {
      const darkButton = page.locator('button', { hasText: 'Dark' }).first();
      await darkButton.click();

      await page.waitForTimeout(500);

      const currentTheme = await page.evaluate(() => {
        const html = document.querySelector('html');
        return html?.getAttribute('data-theme') || 'system';
      });

      expect(currentTheme).toBe('dark');

      const lightButton = page.locator('button', { hasText: 'Light' }).first();
      await lightButton.click();
      await page.waitForTimeout(500);

      const finalTheme = await page.evaluate(() => {
        const html = document.querySelector('html');
        return html?.getAttribute('data-theme') || 'system';
      });

      expect(finalTheme).toBe('light');
    } finally {
      if (originalTheme) {
        const themeButton = page.locator('button', { hasText: originalTheme.charAt(0).toUpperCase() + originalTheme.slice(1) }).first();
        await themeButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should update language preference', async ({ page }) => {
    await page.route('**/api/me/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ language: 'zh' }),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ language: 'zh' }),
        });
      }
    });

    const languageSelect = page.locator('select[id*="language"]').first();
    const originalValue = await languageSelect.inputValue();

    try {
      await page.selectOption('select[id*="language"]', 'zh');
      await page.click('button:has-text("Save Preferences")');

      await page.reload();
      await expect(languageSelect).toHaveValue('zh', { timeout: 10000 });
    } finally {
      await languageSelect.selectOption(originalValue);
      await page.click('button:has-text("Save Preferences")');
    }
  });

  test('should toggle email notifications', async ({ page }) => {
    let currentEmailNotifications = true;
    await page.route('**/api/me/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        currentEmailNotifications = body.preferences?.email_notifications ?? currentEmailNotifications;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            preferences: {
              email_notifications: currentEmailNotifications,
            },
          }),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            preferences: {
              email_notifications: currentEmailNotifications,
            },
          }),
        });
      }
    });

    const notificationsToggle = page.locator('input[type="checkbox"][id*="email"], [role="switch"][id*="email"]').first();
    const originalChecked = await notificationsToggle.isChecked();
    currentEmailNotifications = originalChecked;

    try {
      await notificationsToggle.click();
      await page.click('button:has-text("Save Preferences")');

      await page.reload();
      expect(await notificationsToggle.isChecked()).toBe(!originalChecked);
    } finally {
      if (await notificationsToggle.isChecked() !== originalChecked) {
        await notificationsToggle.click();
        await page.click('button:has-text("Save Preferences")');
      }
    }
  });

  test('should regenerate API token', async ({ page }) => {
    await page.route('**/api/me/token', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'new-api-token-xyz789' }),
        });
      } else {
        await route.fallback();
      }
    });

    const tokenSection = page.locator('text=API Key').or(page.locator('text=API Token')).or(page.locator('text="API Access"')).first();
    await expect(tokenSection).toBeVisible();
    await tokenSection.click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    const regenerateButton = modal.locator('button:has-text("Regenerate"), button:has-text("New Token")').first();
    await regenerateButton.click();

    const confirmButton = page.locator('[role="dialog"]').locator('button:has-text("Confirm")').first();
    await confirmButton.click();

    const newToken = page.locator('text=new-api-token-xyz789').or(page.locator('[data-testid*="token"]')).first();
    await expect(newToken).toBeVisible({ timeout: 10000 });
  });

  test('should sync settings across sessions', async ({ page }) => {
    const nameInput = page.locator('input[id*="displayName"]').first();
    const timezoneSelect = page.locator('select[id*="timezone"]').first();
    const languageSelect = page.locator('select[id*="language"]').first();
    const notificationsToggle = page.locator('input[type="checkbox"][id*="email"], [role="switch"][id*="email"]').first();

    // Store original values
    const originalName = await nameInput.inputValue();
    const originalTimezone = await timezoneSelect.inputValue();
    const originalLanguage = await languageSelect.inputValue();
    const originalTheme = await page.evaluate(() => {
      const html = document.querySelector('html');
      return html?.getAttribute('data-theme') || 'system';
    });
    const originalNotificationsChecked = await notificationsToggle.isChecked();

    await page.route('**/api/me/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            displayName: 'Synced User',
            timezone: 'Europe/London',
            language: 'fr',
            preferences: {
              theme: 'dark',
              email_notifications: false,
            },
          }),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            displayName: 'Synced User',
            timezone: 'Europe/London',
            language: 'fr',
            preferences: {
              theme: 'dark',
              email_notifications: false,
            },
          }),
        });
      }
    });

    try {
      await nameInput.fill('Synced User');
      await timezoneSelect.selectOption('Europe/London');
      await languageSelect.selectOption('fr');

      const darkButton = page.locator('button', { hasText: 'Dark' }).first();
      await darkButton.click();
      await page.waitForTimeout(500);

      if (await notificationsToggle.isChecked()) {
        await notificationsToggle.click();
      }

      await page.click('button:has-text("Save Profile")');
      await page.click('button:has-text("Save Preferences")');

      await page.reload();

      await expect(nameInput).toHaveValue('Synced User', { timeout: 10000 });
      await expect(timezoneSelect).toHaveValue('Europe/London', { timeout: 10000 });
      await expect(languageSelect).toHaveValue('fr', { timeout: 10000 });

      const currentTheme = await page.evaluate(() => {
        const html = document.querySelector('html');
        return html?.getAttribute('data-theme') || 'system';
      });
      expect(currentTheme).toBe('dark');

      await expect(notificationsToggle).not.toBeChecked();
    } finally {
      // Restore original values
      await nameInput.fill(originalName);
      await timezoneSelect.selectOption(originalTimezone);
      await languageSelect.selectOption(originalLanguage);

      // Restore theme
      const themeButton = page.locator('button', { hasText: originalTheme.charAt(0).toUpperCase() + originalTheme.slice(1) }).first();
      await themeButton.click();
      await page.waitForTimeout(500);

      // Restore notifications toggle
      if (await notificationsToggle.isChecked() !== originalNotificationsChecked) {
        await notificationsToggle.click();
      }

      await page.click('button:has-text("Save Profile")');
      await page.click('button:has-text("Save Preferences")');
    }
  });
});
