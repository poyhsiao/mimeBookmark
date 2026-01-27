import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the landing page with title and description', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MimeBookmark');
    await expect(page.locator('p:has-text("Your personal bookmark manager")')).toBeVisible();
  });

  test('should have login and register buttons', async ({ page }) => {
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('text=Get Started')).toBeVisible();
  });

  test('should navigate to login page when clicking Sign In', async ({ page }) => {
    await page.click('text=Sign In');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should navigate to register page when clicking Get Started', async ({ page }) => {
    await page.click('text=Get Started');
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('text=Start organizing your bookmarks today')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toContainText('MimeBookmark');
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('text=Get Started')).toBeVisible();
  });
});

test.describe('Home Page - Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('should have focusable links', async ({ page }) => {
    await page.goto('/');
    const signInLink = page.locator('text=Sign In').first();
    await expect(signInLink).toBeVisible();

    // Test keyboard focus
    await signInLink.focus();
    await expect(signInLink).toBeFocused();

    const getStartedLink = page.locator('text=Get Started').first();
    await expect(getStartedLink).toBeVisible();

    // Test keyboard focus
    await getStartedLink.focus();
    await expect(getStartedLink).toBeFocused();
  });
});
