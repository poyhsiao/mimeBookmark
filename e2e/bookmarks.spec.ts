import { test, expect } from '@playwright/test';
import { authenticateUser } from './fixtures/auth';

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

test.describe('Bookmarks - Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/bookmarks');
  });

  test('should create a new bookmark', async ({ page }) => {
    await page.route('**/api/bookmarks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookmarks: [], total: 0 }),
      });
    });

    await page.route('**/api/bookmarks', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'bookmark-123', url: 'https://example.com', title: 'Example Bookmark' }),
        });
      }
    });

    await page.click('button:has-text("Add Bookmark")');
    await page.fill('input[id*="url"]', 'https://example.com');
    await page.fill('input[id*="title"]', 'Example Bookmark');
    await page.click('button:has-text("Save Bookmark")');

    await expect(page.locator('text=Example Bookmark')).toBeVisible({ timeout: 10000 });
  });

  test('should edit an existing bookmark', async ({ page }) => {
    await page.route('**/api/bookmarks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookmarks: [{ id: 'bookmark-123', url: 'https://example.com', title: 'Example Bookmark' }],
          total: 1,
        }),
      });
    });

    await page.route('**/api/bookmarks/**', async (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'bookmark-123', url: 'https://example.com', title: 'Updated Bookmark' }),
        });
      }
    });

    await page.goto('/dashboard/bookmarks');
    const bookmark = page.locator('text=Example Bookmark').first();
    await expect(bookmark).toBeVisible();

    await bookmark.click();
    await page.fill('input[id*="title"]', 'Updated Bookmark');
    await page.click('button:has-text("Save Changes")');

    await expect(page.locator('text=Updated Bookmark')).toBeVisible({ timeout: 10000 });
  });

  test('should delete a bookmark', async ({ page }) => {
    await page.route('**/api/bookmarks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookmarks: [{ id: 'bookmark-123', url: 'https://example.com', title: 'Example Bookmark' }],
          total: 1,
        }),
      });
    });

    await page.route('**/api/bookmarks/**', async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto('/dashboard/bookmarks');
    const bookmark = page.locator('text=Example Bookmark').first();
    await expect(bookmark).toBeVisible();

    await bookmark.click();
    await page.click('button:has-text("Delete")');

    await expect(page.locator('text=Example Bookmark')).not.toBeVisible({ timeout: 10000 });
  });

  test('should search bookmarks and filter results', async ({ page }) => {
    await page.route('**/api/bookmarks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookmarks: [
            { id: '1', url: 'https://example.com', title: 'Example 1' },
            { id: '2', url: 'https://test.com', title: 'Example 2' },
          ],
          total: 2,
        }),
      });
    });

    await page.route('**/api/search**', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q');
      if (query === 'Example') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bookmarks: [{ id: '1', url: 'https://example.com', title: 'Example 1' }],
            total: 1,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookmarks: [], total: 0 }),
        });
      }
    });

    await page.goto('/dashboard/bookmarks');
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await searchInput.fill('Example');
    
    await expect(page.locator('text=Example 1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Example 2')).not.toBeVisible({ timeout: 10000 });
  });

  test('should add tags to a bookmark', async ({ page }) => {
    await page.route('**/api/bookmarks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookmarks: [{ id: 'bookmark-123', url: 'https://example.com', title: 'Example Bookmark', tags: ['tag1', 'tag2'] }],
          total: 1,
        }),
      });
    });

    await page.goto('/dashboard/bookmarks');
    const bookmark = page.locator('text=Example Bookmark').first();
    await expect(bookmark).toBeVisible();

    await bookmark.click();
    const tagsInput = page.locator('input[type="text"], input[id*="tags"]').first();
    await tagsInput.fill('tag1, tag2');
    await page.click('button:has-text("Save Changes")');

    await expect(page.locator('text=tag1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=tag2')).toBeVisible({ timeout: 10000 });
  });

  test('should add bookmark to collection', async ({ page }) => {
    await page.route('**/api/bookmarks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookmarks: [{ id: 'bookmark-123', url: 'https://example.com', title: 'Example Bookmark', collections: ['collection-1'] }],
          total: 1,
        }),
      });
    });

    await page.goto('/dashboard/bookmarks');
    const bookmark = page.locator('text=Example Bookmark').first();
    await expect(bookmark).toBeVisible();

    await bookmark.click();
    const collectionSelect = page.locator('select').first();
    await collectionSelect.selectOption('collection-1');
    await page.click('button:has-text("Save Changes")');

    await expect(page.locator('text=collection-1')).toBeVisible({ timeout: 10000 });
  });
});
