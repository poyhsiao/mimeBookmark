import { test, expect } from '@playwright/test';

test.describe('Collections Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/collections');
  });

  test('should display page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Collections');
    await expect(page.locator('text=Organize your bookmarks into collections')).toBeVisible();
  });

  test('should display collections section', async ({ page }) => {
    const collectionsSection = page.locator('[class*="collections"]').first();
    await expect(collectionsSection).toBeVisible();
  });

  test('should have add collection button', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Collection")').first();
    await expect(addButton).toBeVisible();
  });

  test('should navigate back to dashboard', async ({ page }) => {
    await page.goto('/dashboard/collections');
    await page.click('text=Dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard/collections');
    
    await expect(page.locator('h1')).toContainText('Collections');
  });
});

test.describe.serial('Collections - With Data', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/collections');
  });

  test('should display collection cards when data exists', async ({ page }) => {
    // Check if any collections exist for this test
    const collectionCards = page.locator('[class*="collection-card"]');
    const count = await collectionCards.count();
    const hasCollections = count > 0;

    test.skip(!hasCollections, 'No collections available - data setup required');

    // Assert that if collections exist, they are visible
    await expect(collectionCards.first()).toBeVisible();
  });

  test('should allow creating a new collection', async ({ page, request }) => {
    const uniqueCollectionName = `Test Collection ${Date.now()}`;

    try {
      await page.goto('/dashboard/collections');
      await page.click('button:has-text("Add Collection")');

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible();

      await page.fill('input[id*="collection-name"], input[name*="name"]', uniqueCollectionName);

      await page.click('button:has-text("Create")');

      await expect(modal).toBeHidden();

      const createdCollection = page.locator(`text=${uniqueCollectionName}`).first();
      await expect(createdCollection).toBeVisible();

      // Find the collection card using has-text and locate delete button within it
      const collectionCard = page.locator('[class*="collection-card"]', { hasText: uniqueCollectionName });
      const deleteButton = collectionCard.locator('button:has-text("Delete"), button[aria-label*="delete"], button:has([data-testid*="delete"])').first();
      await deleteButton.click();

      // Check if confirm button appears (some UIs require confirmation, others delete directly)
      const confirmButton = page.getByRole('dialog').locator('button:has-text("Delete"), button:has-text("Confirm")').first();
      const isConfirmVisible = await confirmButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (isConfirmVisible) {
        await confirmButton.click();
      }

      await expect(createdCollection).toBeHidden({ timeout: 5000 });
    } finally {
      // Cleanup: attempt to delete the collection if it still exists with retries
      const maxRetries = 3;
      let cleanupSuccess = false;

      for (let attempt = 1; attempt <= maxRetries && !cleanupSuccess; attempt++) {
        try {
          const collectionCard = page.locator('[class*="collection-card"]', { hasText: uniqueCollectionName });
          if (await collectionCard.isVisible({ timeout: 1000 })) {
            const deleteButton = collectionCard.locator('button:has-text("Delete"), button[aria-label*="delete"], button:has([data-testid*="delete"])').first();
            await deleteButton.click();

            // Check if confirm button appears
            const confirmButton = page.getByRole('dialog').locator('button:has-text("Delete"), button:has-text("Confirm")').first();
            const isConfirmVisible = await confirmButton.isVisible({ timeout: 2000 }).catch(() => false);
            if (isConfirmVisible) {
              await confirmButton.click();
            }

            // Verify deletion succeeded
            await expect(collectionCard).toBeHidden({ timeout: 3000 });
            cleanupSuccess = true;
          } else {
            cleanupSuccess = true; // Already deleted
          }
        } catch (cleanupError) {
          console.error(`Cleanup attempt ${attempt}/${maxRetries} failed:`, cleanupError);
          if (attempt < maxRetries) {
            await page.waitForTimeout(1000 * attempt); // Progressive delay
          } else {
            throw new Error(`Failed to cleanup collection "${uniqueCollectionName}" after ${maxRetries} attempts: ${cleanupError}`);
          }
        }
      }
    }
  });
});

test.describe.serial('Collections - Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);

    // Mock the collections API to return empty array instead of destructive deletion
    await page.route('**/api/collections**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ collections: [] }),
        });
      } else if (route.request().method() === 'DELETE') {
        // Stub delete calls to prevent actual deletion
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('should show empty state when no collections exist', async ({ page }) => {
    await page.goto('/dashboard/collections');
    const emptyState = page.locator('text=No collections yet').first();
    await expect(emptyState).toBeVisible();
  });
});
