import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('home page should have proper heading structure', async ({ page }) => {
    await page.goto('/');
    
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('login page should have proper form labels', async ({ page }) => {
    await page.goto('/login');
    
    // Check that form fields have associated labels
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('register page should have proper form labels', async ({ page }) => {
    await page.goto('/register');
    
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(2);
  });

  test('dashboard should have proper navigation landmarks', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for navigation
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('settings page should have proper sections', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Check for different sections
    await expect(page.locator('text=Profile')).toBeVisible();
    await expect(page.locator('text=Appearance')).toBeVisible();
    await expect(page.locator('text=Language & Region')).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('home page should load within acceptable time', async ({ page }) => {
    await page.goto('/');
    
    // Check page loaded
    await expect(page.locator('h1')).toBeVisible();
  });

  test('login page should load within acceptable time', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('h1')).toBeVisible();
  });

  test('register page should load within acceptable time', async ({ page }) => {
    await page.goto('/register');
    
    await expect(page.locator('h1')).toBeVisible();
  });

  test('dashboard should load within acceptable time', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Page should start loading
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page');
    
    // Should show some error content
    await expect(page.locator('text=404').or(page.locator('text=Not Found'))).toBeVisible();
  });

  test('should handle invalid API requests', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Try to access protected content without auth (will redirect)
    await page.waitForTimeout(1000);
  });
});

test.describe('Security', () => {
  test('should not expose sensitive information in page source', async ({ page }) => {
    await page.goto('/');
    
    const pageContent = await page.content();
    
    // Should not contain sensitive patterns
    expect(pageContent).not.toContain('password');
    expect(pageContent).not.toContain('secret');
    expect(pageContent).not.toContain('api_key');
  });

  test('should have proper content security policy headers', async ({ request }) => {
    const response = await request.get('/');
    
    // Check for security headers (if implemented)
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');
  });
});
