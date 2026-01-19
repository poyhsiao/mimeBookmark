import { test, expect } from '@playwright/test';

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display register page elements', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MimeBookmark');
    await expect(page.locator('text=Start organizing your bookmarks today')).toBeVisible();
    await expect(page.locator('text=Create an account')).toBeVisible();
  });

  test('should display OAuth buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Google")').first()).toBeVisible();
    await expect(page.locator('button:has-text("GitHub")').first()).toBeVisible();
  });

  test('should display separator with text', async ({ page }) => {
    await expect(page.locator('text=Or continue with')).toBeVisible();
  });

  test('should have all required input fields', async ({ page }) => {
    await expect(page.locator('input[name="fullName"], input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]').first()).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button:has-text("Create account")');
    await expect(page.locator('text=Email is required')).toBeVisible();
  });

  test('should show error for mismatched passwords', async ({ page }) => {
    await page.fill('input[name="fullName"], input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[name="password"], input[type="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password456');
    await page.click('button:has-text("Create account")');
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('should show error for short password', async ({ page }) => {
    await page.fill('input[name="fullName"], input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[name="password"], input[type="password"]', '123');
    await page.fill('input[name="confirmPassword"]', '123');
    await page.click('button:has-text("Create account")');
    await expect(page.locator('text=Password must be at least')).toBeVisible();
  });

  test('should navigate to login page when clicking sign in link', async ({ page }) => {
    await page.click('text=Sign in');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('should be accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/register');
    
    await expect(page.locator('h1')).toContainText('MimeBookmark');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]').first()).toBeVisible();
  });
});
