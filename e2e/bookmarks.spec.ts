import { test, expect } from '@playwright/test';

test.describe('Bookmarks Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/bookmarks');
  });

  test('should display page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Bookmarks');
    await expect(page.locator('text=Manage your bookmarks here')).toBeVisible();
  });

  test('should have add bookmark button', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Bookmark")').first();
    await expect(addButton).toBeVisible();
  });

  test('should display search/filter options', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await expect(searchInput).toBeVisible();
  });

  test('should show empty state when no bookmarks exist', async ({ page }) => {
    // Mock bookmarks API to return empty state for deterministic test
    await page.route('**/api/bookmarks**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookmarks: [], total: 0 }),
      });
    });

    await page.route('**/api/bookmarks/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookmarks: [], total: 0 }),
      });
    });

    const emptyMessage = page.locator('text=No bookmarks yet').or(page.locator('text="You have no bookmarks yet."')).first();
    await expect(emptyMessage).toBeVisible();
  });
});

test.describe('Bookmarks - Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('should open add bookmark modal', async ({ page }) => {
    await page.goto('/dashboard/bookmarks');
    await page.click('button:has-text("Add Bookmark")');

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
  });

  test('should have URL input field in add modal', async ({ page }) => {
    await page.goto('/dashboard/bookmarks');
    await page.click('button:has-text("Add Bookmark")');

    const urlInput = page.locator('input[type="url"], input[id*="url"]');
    await expect(urlInput).toBeVisible();
  });

  test('should have title input field in add modal', async ({ page }) => {
    await page.goto('/dashboard/bookmarks');
    await page.click('button:has-text("Add Bookmark")');

    const titleInput = page.locator('input[id*="title"], input[name*="title"]');
    await expect(titleInput).toBeVisible();
  });

  test('should close modal when cancel button is clicked', async ({ page }) => {
    await page.goto('/dashboard/bookmarks');
    await page.click('button:has-text("Add Bookmark")');

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    await page.click('button:has-text("Cancel")');
    await expect(modal).not.toBeVisible();
  });
});
