import { test, expect } from '@playwright/test';
import { authenticateUser } from './fixtures/auth';

test.describe('Navigation and Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/');
  });

  test('should navigate from home to login', async ({ page }) => {
    await page.click('text=Sign In');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('should navigate from login to register', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Sign up');
    await expect(page).toHaveURL(/\/register$/);
  });

  test('should navigate from register to login', async ({ page }) => {
    await page.goto('/register');
    await page.click('text=Sign in');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Dashboard - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('sidebar should be visible on dashboard pages', async ({ page }) => {
    await page.goto('/dashboard');

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
  });

  test('sidebar should have correct navigation items', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Collections')).toBeVisible();
    await expect(page.locator('text=Bookmarks')).toBeVisible();
    await expect(page.locator('text=Tags')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('sidebar should show user email', async ({ page }) => {
    await page.goto('/dashboard');

    // Use more specific selector for user email in sidebar
    // TODO: Add data-testid="user-email" to the component for more reliable testing
    const userEmail = page.locator('aside').locator('text=@').first();
    await expect(userEmail).toBeVisible();
  });

  test('sidebar should have sign out button', async ({ page }) => {
    await page.goto('/dashboard');

    const signOutButton = page.locator('button:has-text("Sign out")');
    await expect(signOutButton).toBeVisible();
  });

  test('should navigate through all dashboard pages', async ({ page }) => {
    // Test dashboard home
    await page.goto('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Test collections
    await page.goto('/dashboard/collections');
    await expect(page.locator('text=Collections')).toBeVisible();

    // Test bookmarks
    await page.goto('/dashboard/bookmarks');
    await expect(page.locator('text=Bookmarks')).toBeVisible();

    // Test tags
    await page.goto('/dashboard/tags');
    await expect(page.locator('text=Tags')).toBeVisible();

    // Test settings
    await page.goto('/dashboard/settings');
    await expect(page.locator('text=Settings')).toBeVisible();
  });
});

test.describe('Navigation - Keyboard Accessibility', () => {
  test('should allow tab navigation', async ({ page }) => {
    await page.goto('/');
    
    // Press tab to navigate through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify we can tab through the page
    const activeElement = page.locator(':focus');
    await expect(activeElement).toBeVisible();
  });
});

test.describe('Navigation - Logo', () => {
  test('clicking logo should navigate to dashboard', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard');

    const logo = page.locator('text=MimeBookmark').first();
    await logo.click();

    const currentUrl = new URL(page.url()).pathname;
    expect(currentUrl).toBe('/dashboard');
  });
});
