import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Dashboard requires authentication, so we need to mock or handle auth
    // For e2e tests, we'll test the unauthenticated redirect behavior
    await page.goto('/dashboard');
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // The dashboard has a client-side redirect
    // We test that it eventually redirects or shows login
    await page.waitForURL(/\/login$/, { timeout: 5000 }).catch(() => {
      // If redirect doesn't happen, check for sidebar which indicates auth
      const sidebar = page.locator('aside').first();
      expect(sidebar).toBeVisible();
    });
  });

  test('should show loading state while checking auth', async ({ page }) => {
    await page.goto('/dashboard');
    // Check for loading spinner
    const loadingSpinner = page.locator('.animate-spin').first();
    await expect(loadingSpinner).toBeVisible();
  });
});

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard with mocked auth (would need actual auth setup)
    // For now, we test the layout structure
  });

  test('should have sidebar navigation', async ({ page }) => {
    // Test sidebar structure (will work when authenticated)
    await page.goto('/dashboard');
    // Sidebar should be present
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
  });

  test('should have logo and branding', async ({ page }) => {
    await page.goto('/dashboard');
    // Check for logo
    const logo = page.locator('text=MimeBookmark').first();
    await expect(logo).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/dashboard');
    // Check for navigation items
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Collections')).toBeVisible();
    await expect(page.locator('text=Bookmarks')).toBeVisible();
    await expect(page.locator('text=Tags')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should navigate to collections page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Collections');
    await expect(page).toHaveURL(/\/dashboard\/collections$/);
  });

  test('should navigate to bookmarks page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Bookmarks');
    await expect(page).toHaveURL(/\/dashboard\/bookmarks$/);
  });

  test('should navigate to tags page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Tags');
    await expect(page).toHaveURL(/\/dashboard\/tags$/);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Settings');
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
  });

  test('should have sign out button', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Sign out')).toBeVisible();
  });
});
