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

  test('should have create button', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create")').first();
    await expect(createButton).toBeVisible();
  });

  test('should have search/filter input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search tags"]').first();
    await expect(searchInput).toBeVisible();
  });

  test('should show empty state when no tags exist', async ({ page }) => {
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

test.describe('Tags - Functionality', () => {
  test('should allow creating a new tag', async ({ page }) => {
    await page.goto('/dashboard/tags');
    
    // Fill tag name
    await page.fill('input[placeholder*="Enter tag name"]', 'Test Tag');
    
    // Select color
    await page.click('[style*="background-color"]:first-of-type');
    
    // Create tag
    await page.click('button:has-text("Create")');
  });

  test('should filter tags by search query', async ({ page }) => {
    await page.goto('/dashboard/tags');
    
    // Type in search
    const searchInput = page.locator('input[placeholder*="Search tags"]').first();
    await searchInput.fill('javascript');
  });

  test('should have pagination controls', async ({ page }) => {
    await page.goto('/dashboard/tags');
    const pagination = page.locator('text=Page').first();
    await expect(pagination).toBeVisible();
  });
});
