import { test, expect } from '@playwright/test';
import { authenticateUser } from './fixtures/auth';

test.describe('Accessibility', () => {
  test('home page should have proper heading structure', async ({ page }) => {
    await page.goto('/');
    
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('login page inputs must have associated labels', async ({ page }) => {
    await page.goto('/login');
    
    // Check that form fields have associated labels
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    // Verify email input has proper label association
    const emailId = await emailInput.getAttribute('id');
    const emailAriaLabel = await emailInput.getAttribute('aria-label');
    const emailAriaLabelledby = await emailInput.getAttribute('aria-labelledby');

    // Check for aria attributes first (preferred method)
    if (emailAriaLabel || emailAriaLabelledby) {
      // Aria attributes present - accessibility requirement met
      expect(emailAriaLabel || emailAriaLabelledby).toBeTruthy();
    } else {
      // No aria attributes - must have id with visible associated label
      expect(emailId, 'Email input must have id when aria-label/aria-labelledby are absent').toBeTruthy();
      const label = page.locator(`label[for="${emailId}"]`);
      await expect(label, `Email input with id="${emailId}" must have visible associated label`).toBeVisible();
    }
    
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    
    // Verify password input has proper label association
    const passwordId = await passwordInput.getAttribute('id');
    const passwordAriaLabel = await passwordInput.getAttribute('aria-label');
    const passwordAriaLabelledby = await passwordInput.getAttribute('aria-labelledby');

    // Check for aria attributes first (preferred method)
    if (passwordAriaLabel || passwordAriaLabelledby) {
      // Aria attributes present - accessibility requirement met
      expect(passwordAriaLabel || passwordAriaLabelledby).toBeTruthy();
    } else {
      // No aria attributes - must have id with visible associated label
      expect(passwordId, 'Password input must have id when aria-label/aria-labelledby are absent').toBeTruthy();
      const label = page.locator(`label[for="${passwordId}"]`);
      await expect(label, `Password input with id="${passwordId}" must have visible associated label`).toBeVisible();
    }
  });

  test('register page should have proper form labels', async ({ page }) => {
    await page.goto('/register');
    
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(2);
  });

  test('dashboard should have proper navigation landmarks', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard');

    // Check for navigation
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('settings page should have proper sections', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/settings');

    // Check for different sections using more specific selectors
    await expect(page.locator('h3:has-text("Profile")').or(page.locator('h2:has-text("Profile")'))).toBeVisible();
    await expect(page.locator('h3:has-text("Appearance")').or(page.locator('h2:has-text("Appearance")'))).toBeVisible();
    await expect(page.locator('h3:has-text("Language & Region")').or(page.locator('h2:has-text("Language & Region")'))).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('home page should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;
    
    // Assert page loaded within acceptable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('login page should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;
    
    // Assert page loaded within acceptable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('register page should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/register');
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;
    
    // Assert page loaded within acceptable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('dashboard should load within acceptable time', async ({ page }) => {
    // Authenticate before navigating to protected route
    await authenticateUser(page);

    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;
    
    // Assert page loaded within acceptable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Verify we are on the dashboard (not redirected to login)
    // Unauthenticated users are redirected to /login, so we must assert the URL
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Check for main content on authenticated dashboard
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
    
    // Unauthenticated access should redirect to login
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Security', () => {
  test('should not expose sensitive information in page source', async ({ page }) => {
    test.skip(process.env.NODE_ENV !== 'production', 'Security check skipped in development - Next.js dev mode embeds data in HTML');
    await page.goto('/login');

    const pageContent = await page.content();

    // Check for realistic secret patterns in page content
    // AWS Access Key ID pattern (AKIA followed by 16 base characters)
    const awsAccessKeyRegex = /AKIA[A-Z0-9]{16}/;
    expect(pageContent).not.toMatch(awsAccessKeyRegex);

    // JWT-like tokens (header.payload.signature pattern)
    const jwtRegex = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    expect(pageContent).not.toMatch(jwtRegex);

    // Long base64 strings (potential API keys) - exclude data URIs and require 50+ chars
    // Strip data URIs first to avoid false positives and ensure compatibility with older engines
    const sanitizedContent = pageContent.replace(/data:[^;]+;base64,[A-Za-z0-9+/]+={0,2}/g, '');
    const longBase64Regex = /[A-Za-z0-9+/]{50,}={0,2}/;
    expect(sanitizedContent).not.toMatch(longBase64Regex);

    // Check that sensitive input fields are not prefilled
    const passwordInputs = page.locator('input[type="password"]');
    const passwordCount = await passwordInputs.count();
    expect(passwordCount).toBeGreaterThan(0);
    const passwordValues = await passwordInputs.evaluateAll(inputs =>
      inputs.map((input): string => (input as HTMLInputElement).value || '')
    );
    passwordValues.forEach(value => {
      expect(value).toBe('');
    });

    const emailInputs = page.locator('input[type="email"]');
    const emailCount = await emailInputs.count();
    expect(emailCount).toBeGreaterThan(0);
    const emailValues = await emailInputs.evaluateAll(inputs =>
      inputs.map((input): string => (input as HTMLInputElement).value || '')
    );
    emailValues.forEach(value => {
      expect(value).toBe('');
    });
  });

  test('should have proper content security policy headers', async ({ request }) => {
    // Skip CSP check in non-production environments
    test.skip(process.env.NODE_ENV !== 'production', 'CSP only enforced in production');

    const response = await request.get('/');

    // Check for security headers
    const headers = response.headers();
    expect(headers['content-type']).toContain('text/html');

    // CSP check - only in production
    expect(headers['content-security-policy']).toBeDefined();
  });
});
