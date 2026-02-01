import { test, expect } from './setup';

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

test.describe('Tags - Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
  });

  test('should create a tag via bookmarks page', async ({ page }) => {
    await page.route('**/api/tags**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'tag-1', name: 'development', color: '#FF0000' }),
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tags: [{ id: 'tag-1', name: 'development', color: '#FF0000' }], total: 1 }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/api/bookmarks**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookmarks: [], total: 0 }),
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'bookmark-1', title: 'Test', url: 'https://example.com' }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/dashboard/bookmarks');
    await page.click('button:has-text("Add Bookmark")');
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    const tagsInput = page.locator('input[type="text"], input[id*="tags"]').first();
    await tagsInput.fill('development');
    await page.click('button:has-text("Save Bookmark")');

    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('should edit a tag', async ({ page }) => {
    let currentTagName = 'development';
    let currentTagColor = '#FF0000';

    await page.route('**/api/tags**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tags: [{ id: 'tag-1', name: currentTagName, color: currentTagColor }],
            total: 1,
          }),
        });
      } else if (method === 'PUT') {
        currentTagName = 'engineering';
        currentTagColor = '#00FF00';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'tag-1', name: currentTagName, color: currentTagColor }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/dashboard/tags');

    const tagElement = page.locator('text=development').first();
    await expect(tagElement).toBeVisible({ timeout: 10000 });

    await tagElement.click();
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    await page.fill('input[id*="tag-name"], input[name*="name"]', 'engineering');
    await page.click('button:has-text("Save Changes")');

    await expect(page.locator('text=engineering')).toBeVisible({ timeout: 10000 });
  });

  test('should delete a tag', async ({ page }) => {
    let tagDeleted = false;

    await page.route('**/api/tags**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            tagDeleted
              ? { tags: [], total: 0 }
              : { tags: [{ id: 'tag-1', name: 'development', color: '#FF0000' }], total: 1 }
          ),
        });
      } else if (method === 'DELETE') {
        tagDeleted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/dashboard/tags');

    const tagElement = page.locator('text=development').first();
    await expect(tagElement).toBeVisible({ timeout: 10000 });

    await tagElement.click();
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    const deleteButton = modal.locator('button:has-text("Delete"), button[aria-label*="delete"]').first();
    await deleteButton.click();

    const confirmButton = page.locator('[role="dialog"]').locator('button:has-text("Delete"), button:has-text("Confirm")').first();
    const isConfirmVisible = await confirmButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isConfirmVisible) {
      await confirmButton.click();
    }

    await expect(page.locator('text=development')).not.toBeVisible({ timeout: 10000 });
  });

  test('should merge two tags', async ({ page }) => {
    let tagsMerged = false;

    await page.route('**/api/tags**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            tagsMerged
              ? { tags: [{ id: 'tag-2', name: 'js', color: '#00FF00' }], total: 1 }
              : {
                  tags: [
                    { id: 'tag-1', name: 'javascript', color: '#FF0000' },
                    { id: 'tag-2', name: 'js', color: '#00FF00' },
                  ],
                  total: 2,
                }
          ),
        });
      } else if (method === 'PUT') {
        tagsMerged = true;
        const url = new URL(route.request().url());
        const pathParts = url.pathname.split('/');
        const tagId = pathParts[pathParts.length - 1];

        if (tagId === 'tag-1') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'tag-1', name: 'javascript', color: '#FF0000', mergedInto: 'tag-2' }),
          });
        } else if (tagId === 'tag-2') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'tag-2', name: 'js', color: '#00FF00', mergedWith: ['tag-1'] }),
          });
        } else {
          await route.fallback();
        }
      } else {
        await route.fallback();
      }
    });

    await page.goto('/dashboard/tags');

    const sourceTag = page.locator('text=javascript').first();
    await expect(sourceTag).toBeVisible({ timeout: 10000 });

    await sourceTag.click();
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    const mergeSelect = page.locator('select').first();
    await mergeSelect.selectOption('js');
    await page.click('button:has-text("Merge")');

    await expect(page.locator('text=javascript')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=js')).toBeVisible({ timeout: 10000 });
  });

  test('should handle duplicate tag names', async ({ page }) => {
    await page.route('**/api/tags**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tags: [{ id: 'tag-1', name: 'javascript', color: '#FF0000' }],
            total: 1,
          }),
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Tag name already exists' }),
        });
      }
    });

    await page.goto('/dashboard/tags');

    const nameInput = page.locator('input[placeholder*="Enter tag name"]').first();
    await nameInput.fill('javascript');
    await page.click('button:has-text("Create")');

    const errorMessage = page.locator('text=already exists').or(page.locator('text=duplicate')).or(page.locator('[role="alert"]')).first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should validate tag name length', async ({ page }) => {
    await page.route('**/api/tags**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Tag name is too long' }),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tags: [], total: 0 }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/dashboard/tags');

    const nameInput = page.locator('input[placeholder*="Enter tag name"]').first();
    const longName = 'A'.repeat(300);

    await nameInput.fill(longName);
    await page.click('button:has-text("Create")');

    const errorMessage = page.locator('text=too long').or(page.locator('text=maximum')).or(page.locator('text=character')).or(page.locator('[role="alert"]')).first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
