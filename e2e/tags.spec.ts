import { test, expect } from '@playwright/test';

test.describe('Tags Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/tags');
  });

  test('should display page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Tags');
    await expect(page.locator('text=Organize and manage your tags')).toBeVisible();
  });

  test('should have create new tag section', async ({ page }) => {
    const createSection = page.locator('text=Create New Tag').first();
    await expect(createSection).toBeVisible();
  });

  test('should have tag name input', async ({ page }) => {
    const nameInput = page.locator('input[placeholder*="Enter tag name"]').first();
    await expect(nameInput).toBeVisible();
  });

  test('should have color selection options', async ({ page }) => {
    const colorButtons = page.locator('[style*="background-color"]').first();
    await expect(colorButtons).toBeVisible();
  });
    const createSection = page.locator('text=Create New Tag').first();
    await expect(createSection).toBeVisible();
  });

  test('should have tag name input', async ({ page }) => {
    const nameInput = page.locator('input[placeholder*="Enter tag name"]').first();
    await expect(nameInput).toBeVisible();
  });

  test('should have color selection options', async ({ page }) => {
    const colorButtons = page.locator('[style*="background-color"]').first();
    await expect(colorButtons).toBeVisible();
  });

  test('should have create button', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create")').first();
    await expect(createButton).toBeVisible();
  });

  test('should have search/filter input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search tags"]').first();
    await expect(searchInput).toBeVisible();
  });

  test('should show empty state when no tags exist', async ({ page }) => {
    // Mock the tags API to return empty array instead of destructive deletion
    await page.route('**/api/tags**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tags: [] }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/tags');
    const emptyState = page.locator('text=No tags yet').first();
    await expect(emptyState).toBeVisible();
  });

  test('should navigate to other pages', async ({ page }) => {
    await page.click('text=Collections');
    await expect(page).toHaveURL(/\/dashboard\/collections$/);
    
    await page.goto('/dashboard/tags');
    await page.click('text=Bookmarks');
    await expect(page).toHaveURL(/\/dashboard\/bookmarks$/);
  });
});

test.describe.serial('Tags - Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('should display API-created tag in UI', async ({ page }) => {
    await page.goto('/dashboard/tags');

    let createdTagId: string | null = null;

    try {
      // Create tag via API to get reliable ID
      const response = await page.request.post('/api/tags', {
        data: {
          name: 'Test Tag',
          color: '#FF0000'
        }
      });

      // Assert response is OK, fail fast if API error
      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(`Failed to create tag via API: ${response.status()} - ${errorText}`);
      }

      const createdTag = await response.json();
      createdTagId = createdTag.id;

      // Verify UI displays the tag
      await page.reload();
      const tagElement = page.locator('text=Test Tag').first();
      await expect(tagElement).toBeVisible({ timeout: 5000 });
    } finally {
      // Clean up the created tag
      if (createdTagId) {
        try {
          await page.request.delete(`/api/tags/${createdTagId}`);
        } catch (error) {
          console.error(`Failed to delete tag ${createdTagId} during cleanup:`, error);
        }
      }
    }
  });

  test('should filter tags by search query', async ({ page }) => {
    await page.goto('/dashboard/tags');

    let createdTagId: string | null = null;

    try {
      // Create tag via API to get reliable ID
      const response = await page.request.post('/api/tags', {
        data: {
          name: 'javascript-test',
          color: '#00FF00'
        }
      });

      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(`Failed to create tag via API: ${response.status()} - ${errorText}`);
      }

      const createdTag = await response.json();
      createdTagId = createdTag.id;

      // Reload page to see the new tag
      await page.reload();
      const tagElement = page.locator('text=javascript-test').first();
      await expect(tagElement).toBeVisible();

      const searchInput = page.locator('input[placeholder*="Search tags"]').first();
      await searchInput.fill('javascript-test');

      await expect(page.locator('text=javascript-test').first()).toBeVisible();
    } finally {
      // Clean up the created tag
      if (createdTagId) {
        try {
          await page.request.delete(`/api/tags/${createdTagId}`);
        } catch (error) {
          console.error(`Failed to delete tag ${createdTagId} during cleanup:`, error);
        }
      }
    }
  });

  test('should have pagination controls', async ({ page }) => {
    await page.goto('/dashboard/tags');

    const listResponse = await page.request.get('/api/tags?limit=1000');

    if (!listResponse.ok()) {
      const errorText = await listResponse.text();
      throw new Error(`Failed to list tags: ${listResponse.status()} - ${errorText}`);
    }

    const { tags } = await listResponse.json();
    const pageSize = 20;

    const pagination = page.locator('text=Page').first();

    if (tags.length > pageSize) {
      await expect(pagination).toBeVisible();
    } else {
      await expect(pagination).not.toBeVisible();
    }
  });
});
