import { test as base } from '@playwright/test';
import { createMockSession } from './fixtures/auth';

// Extend base test with mock authentication setup
export const test = base.extend({
  page: async ({ page }, use) => {
    // Check if we're using mock authentication
    if (process.env.E2E_USE_MOCK === 'true') {
      // Get Supabase project ref from environment
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      let projectRef = 'local';

      if (supabaseUrl) {
        try {
          const hostname = new URL(supabaseUrl).hostname;
          const match = hostname.match(/^([^.]+)\.supabase\.co$/);
          if (match) {
            projectRef = match[1];
          }
        } catch {
          // Fallback to 'local'
        }
      }

      // Create mock session data using canonical factory
      const mockSession = createMockSession();

      // Inject initialization script to set up localStorage before page loads
      await page.addInitScript(({ projectRef, mockSession, e2eTestMode }) => {
        // Set the mock session in localStorage
        const storageKey = `sb-${projectRef}-auth-token`;
        localStorage.setItem(storageKey, JSON.stringify(mockSession));

        // Also set for backward compatibility
        const oldStorageKey = `sb-${projectRef}-auth-token-code-verifier`;
        localStorage.setItem(oldStorageKey, '');

        // Set flag for E2E testing
        localStorage.setItem('e2e-test-mode', e2eTestMode);
      }, { projectRef, mockSession, e2eTestMode: 'true' });

      // Set the E2E test mode cookie (for middleware)
      const context = page.context();

      // Derive domain from BASE_URL or default to parsing the base URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      let cookieDomain: string | undefined = undefined;

      try {
        const urlObj = new URL(baseUrl);
        // For localhost, omit domain (browser handles it correctly)
        // For other domains, use hostname without port
        if (urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
          cookieDomain = urlObj.hostname;
        }
        // For localhost, leave undefined to let browser set it automatically
      } catch {
        // If URL parsing fails, leave undefined for browser to handle
        cookieDomain = undefined;
      }

      await context.addCookies([
        {
          name: 'e2e-test-mode',
          value: 'true',
          domain: cookieDomain,
          path: '/',
          sameSite: 'Lax' as const,
        },
        {
          name: `sb-${projectRef}-auth-token-code-verifier`,
          value: '',
          domain: cookieDomain,
          path: '/',
          sameSite: 'Lax' as const,
        },
      ]);

      // Intercept all requests to Supabase auth endpoints (catch-all, must be FIRST)
      // Playwright matches routes in LIFO order, so catch-all is registered first
      await page.route('**/auth/v1/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              session: mockSession,
              user: mockSession.user,
            },
          }),
        });
      });

      // Intercept requests to getUser endpoint (registered after catch-all)
      await page.route('**/auth/v1/user**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: mockSession.user,
            },
          }),
        });
      });

      // Intercept getSession requests (registered after catch-all)
      await page.route('**/auth/v1/session**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              session: mockSession,
            },
          }),
        });
      });
    }

    // Use the page
    await use(page);
  },
});

export { expect } from '@playwright/test';
