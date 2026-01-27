import { test as base } from '@playwright/test';
import { setupMockSupabaseAuth } from './supabaseTestUtils';

// Extend base test with mock authentication setup
export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.E2E_USE_MOCK === 'true') {
      await setupMockSupabaseAuth(page);
    }

    await use(page);
  },
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
