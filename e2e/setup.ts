import { test as base, expect } from '@playwright/test';
import { setupMockSupabaseAuth } from './supabaseTestUtils';

export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.E2E_USE_MOCK === 'true') {
      await setupMockSupabaseAuth(page);
    }

    await use(page);
  },
});

export { expect };
