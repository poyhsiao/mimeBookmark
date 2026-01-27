import { test, expect } from '@playwright/test';

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

  test('should have export section', async ({ page }) => {
    const exportSection = page.locator('text=Export Bookmarks').first();
    await expect(exportSection).toBeVisible();
  });

  test('should have import section', async ({ page }) => {
    const importSection = page.locator('text=Import Bookmarks').first();
    await expect(importSection).toBeVisible();
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
