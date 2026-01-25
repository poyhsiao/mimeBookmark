import { Page } from '@playwright/test';

/**
 * Helper function to authenticate a user in E2E tests
 * This sets up authentication cookies/session on the provided page
 *
 * For CI/CD environments without real credentials, use mock authentication
 * by setting E2E_USE_MOCK=true
 */
export async function authenticateUser(page: Page): Promise<void> {
  // Check for mock authentication mode
  if (process.env.E2E_USE_MOCK === 'true') {
    await setupMockAuth(page);
    return;
  }

  // Validate required environment variables
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing required environment variables: E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set. ' +
      'Alternatively, set E2E_USE_MOCK=true for mock authentication in development.'
    );
  }

  await performLogin(page, email, password);
}

async function performLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });

  await emailInput.fill(email);
  await passwordInput.fill(password);

  await page.click('button[type="submit"]');

  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });
}

async function setupMockAuth(page: Page): Promise<void> {
  await page.route('**/api/auth/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
        },
        session: {
          access_token: 'mock-token-123',
          refresh_token: 'mock-refresh-123',
        },
      }),
    });
  });

  await page.route(/\/api\/me(?:[/?#]|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        subscription_tier: 'pro',
        bookmarks_count: 100,
      }),
    });
  });

  await page.route('**/*.supabase.co/auth/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        event: 'SIGNED_IN',
        session: {
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
          },
          access_token: 'mock-token-123',
        },
      }),
    });
  });

  // Navigate to the application origin first so localStorage is set on the correct domain
  await page.goto('/dashboard');

  // Set up client-side auth state in localStorage to match Supabase session format
  // Extract project ref from NEXT_PUBLIC_SUPABASE_URL to generate correct storage key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  await page.evaluate((url) => {
    const mockSession = {
      access_token: 'mock-token-123',
      refresh_token: 'mock-refresh-123',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    };

    // Extract project ref from Supabase URL (format: https://<project-ref>.supabase.co)
    let projectRef = 'local';
    if (url) {
      try {
        const hostname = new URL(url).hostname;
        const match = hostname.match(/^([^.]+)\.supabase\.co$/);
        if (match) {
          projectRef = match[1];
        }
      } catch {
        // Fallback to 'local' if URL parsing fails
      }
    }

    // Supabase JS v2 uses: sb-<project-ref>-auth-token
    const storageKey = `sb-${projectRef}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(mockSession));
  }, supabaseUrl);

  // Reload the page so the app reads the seeded session from localStorage
  await page.reload();
  await page.waitForLoadState('networkidle');
}
