import { Page } from '@playwright/test';

/**
 * Helper function to authenticate a user in E2E tests
 * This sets up authentication cookies/session on the provided page
 */
export async function authenticateUser(page: Page): Promise<void> {
  // Validate required environment variables
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing required environment variables: E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set. ' +
      'Please configure these in your .env file or environment.'
    );
  }

  // Navigate to login page and perform sign-in
  await page.goto('/login');

  // Fill in login credentials - using test user from test setup
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  // Wait for inputs to be visible before filling
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });

  // Fill credentials (using environment variables)
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard after successful login
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });
}
