import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page elements', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MimeBookmark');
    await expect(page.locator('p:has-text("Your personal bookmark manager")')).toBeVisible();
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('should display OAuth buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Google")').first()).toBeVisible();
    await expect(page.locator('button:has-text("GitHub")').first()).toBeVisible();
  });

  test('should display separator with text', async ({ page }) => {
    await expect(page.locator('text=Or continue with')).toBeVisible();
  });

  test('should have email and password input fields', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show required validation for empty fields', async ({ page }) => {
    await page.click('button:has-text("Sign in")');
    // Check for validation error
    await expect(page.locator('text=Email is required')).toBeVisible();
  });

  test('should validate email format on submit', async ({ page }) => {
    // Fill invalid email but valid password to trigger email validation
    await page.fill('input[type="email"]', 'invalid-email-format');
    await page.fill('input[type="password"]', 'password123');

    // Click the Sign in button to trigger form submission
    await page.click('button:has-text("Sign in")');

    // Check for validation error message
    await expect(page.locator('p.text-destructive:has-text("Please enter a valid email")')).toBeVisible();
  });

  test('should show error for short password', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', '123');
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('text=Password must be at least')).toBeVisible();
  });

  test('should navigate to register page when clicking sign up link', async ({ page }) => {
    await page.click('text=Sign up');
    await expect(page).toHaveURL(/\/register$/);
  });

  test('should handle successful login flow (mocked)', async ({ page }) => {
    // This test would need proper mocking setup
    // For now, we test the form structure
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });
});

test.describe('Login Page - Responsive', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    
    await expect(page.locator('h1')).toContainText('MimeBookmark');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
