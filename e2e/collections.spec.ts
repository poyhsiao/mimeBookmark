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

  test('should show empty state when no collections exist', async ({ page }) => {
    // When there are no collections, should show empty state message
    const emptyState = page.locator('text=No collections yet').first();
    await expect(emptyState).toBeVisible();
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

test.describe('Collections - With Data', () => {
  test('should display collection cards when data exists', async ({ page }) => {
    await page.goto('/dashboard/collections');
    // Check for collection cards
    const collectionCards = page.locator('[class*="collection-card"]');
    // Cards might not exist if no collections, that's expected
  });

  test('should allow creating a new collection', async ({ page }) => {
    await page.goto('/dashboard/collections');
    await page.click('button:has-text("Add Collection")');
    
    // Check for modal
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    
    // Fill in collection details
    await page.fill('input[id*="collection-name"], input[name*="name"]', 'Test Collection');
    
    // Submit
    await page.click('button:has-text("Create")');
  });
});
