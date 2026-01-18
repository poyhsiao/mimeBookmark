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
  test('should allow saving profile', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Fill display name
    await page.fill('input[id*="displayName"]', 'Test User');
    
    // Save profile
    await page.click('button:has-text("Save Profile")');
  });

  test('should allow changing theme', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Click dark theme option
    await page.click('button[value="dark"]');
  });

  test('should allow changing language', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Select language
    await page.selectOption('select[id*="language"]', 'zh');
  });

  test('should allow changing timezone', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Select timezone
    await page.selectOption('select[id*="timezone"]', 'America/Los_Angeles');
  });

  test('should have save preferences button', async ({ page }) => {
    await page.goto('/dashboard/settings');
    const saveButton = page.locator('button:has-text("Save Preferences")').first();
    await expect(saveButton).toBeVisible();
  });

  test('should display user statistics', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Check for stats cards
    await expect(page.locator('text=Bookmarks')).toBeVisible();
    await expect(page.locator('text=Collections')).toBeVisible();
    await expect(page.locator('text=Tags')).toBeVisible();
    await expect(page.locator('text=Plan')).toBeVisible();
  });
});

test.describe('Settings - Responsive', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/settings');
    
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.locator('text=Profile')).toBeVisible();
  });
});
