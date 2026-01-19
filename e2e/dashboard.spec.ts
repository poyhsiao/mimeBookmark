import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/, { timeout: 5000 });
  });

  test('should show loading state while checking auth', async ({ page }) => {
    let continueRoute: (() => Promise<void>) | null = null;
    let routeReadyResolve: (() => void) | null = null;
    const routeReadyPromise = new Promise<void>((resolve) => {
      routeReadyResolve = resolve;
    });

    // Set up route interception BEFORE navigation to ensure it's active
    await page.route('**/api/me/**', async route => {
      // Hold the route and store the continuation function
      continueRoute = async () => {
        await route.continue();
      };
      // Signal that the route handler has been set up
      if (routeReadyResolve) {
        routeReadyResolve();
      }
    });

    // Start navigation (don't await yet)
    const navigationPromise = page.goto('/dashboard');

    // Wait for the request to be intercepted
    await page.waitForRequest('**/api/me/**', { timeout: 5000 });

    // Wait for the route handler to set up the continuation function
    await routeReadyPromise;

    // Assert loading spinner is visible while request is held
    const loadingSpinner = page.locator('[aria-busy="true"], [role="status"], [data-testid="loading"]').first();
    await expect(loadingSpinner).toBeVisible({ timeout: 2000 });

    // Release the intercepted route (guaranteed to be non-null)
    if (continueRoute) {
      await continueRoute();
    }

    // Wait for navigation to complete
    await navigationPromise;
  });
});

test.describe.skip('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Add authenticated storageState or setup authentication
    // Option A: test.use({ storageState: 'auth.json' }) at top of describe
    // Option B: Perform authenticated setup in test.beforeEach (addCookies, login helper)
    // Currently skipped because tests navigate to /dashboard unauthenticated and hit login redirect
    // For now, we test layout structure
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
