import { Page } from '@playwright/test';

/**
 * Canonical mock session matching Supabase session format exactly
 * Shared across setupMockAuth and API route mocks to ensure consistency
 */
export function createMockSession() {
  return {
    access_token: 'mock-access-token-123',
    refresh_token: 'mock-refresh-token-123',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer' as const,
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      phone_confirmed_at: null,
      last_sign_in_at: new Date().toISOString(),
      app_metadata: {
        provider: 'email',
        providers: ['email'],
      },
      user_metadata: {
        full_name: 'Test User',
        email: 'test@example.com',
      },
      identities: [
        {
          identity_id: 'test-identity-123',
          id: 'test-user-123',
          user_id: 'test-user-123',
          identity_data: {
            email: 'test@example.com',
          },
          provider: 'email',
          last_sign_in_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      aud: 'authenticated',
      role: 'authenticated',
    },
    session_id: 'test-session-123',
  };
}

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

  // Use shared canonical mock session
  const mockSession = createMockSession();

  // Inject initialization script to set up localStorage BEFORE any page loads
  // This ensures the Supabase client will find the session on initialization
  await page.addInitScript(({ projectRef, mockSession }) => {
    // Set the mock session in localStorage using the exact key format Supabase expects
    const storageKey = `sb-${projectRef}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(mockSession));

    // Also clear any old keys that might interfere
    const oldKeys = Object.keys(localStorage);
    oldKeys.forEach(key => {
      if (key.startsWith(`sb-${projectRef}-`) && key !== storageKey) {
        localStorage.removeItem(key);
      }
    });
  }, { projectRef, mockSession });

  // Set cookies for middleware authentication bypass
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
      domain: cookieDomain, // undefined for localhost, hostname for other domains
      path: '/',
      sameSite: 'Lax' as const,
    },
  ]);

  // Set up all API route mocks BEFORE navigation
  await setupAPIRoute(page);
}

async function setupAPIRoute(page: Page): Promise<void> {
  // Mock all /api/me routes
  await page.route('**/api/me/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/settings')) {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            settings: {
              displayName: 'Test User',
              avatarUrl: null,
              timezone: 'UTC',
              subscriptionTier: 'pro',
              bookmarksLimit: 10000,
              collectionsLimit: 100,
              tagsLimit: 1000,
              preferences: {
                theme: 'system',
                language: 'en',
                email_notifications: true,
              },
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          settings: {
            displayName: 'Test User',
            avatarUrl: null,
            timezone: 'UTC',
            subscriptionTier: 'pro',
            bookmarksLimit: 10000,
            collectionsLimit: 100,
            tagsLimit: 1000,
            preferences: {
              theme: 'system',
              language: 'en',
              email_notifications: true,
            },
          },
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/stats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: {
            totalBookmarks: 100,
            archivedBookmarks: 10,
            favoriteBookmarks: 20,
            readLaterBookmarks: 5,
            totalCollections: 15,
            totalTags: 25,
          },
        }),
      });
      return;
    }

    // Default /api/me response
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

  // Mock bookmarks, collections, and tags APIs
  // Use patterns that match both base paths and subpaths
  await page.route('**/api/bookmarks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookmarks: [], total: 0 }),
    });
  });
  await page.route('**/api/bookmarks/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookmarks: [], total: 0 }),
    });
  });

  await page.route('**/api/collections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ collections: [], total: 0 }),
    });
  });
  await page.route('**/api/collections/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ collections: [], total: 0 }),
    });
  });

  await page.route('**/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tags: [], total: 0 }),
    });
  });
  await page.route('**/api/tags/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tags: [], total: 0 }),
    });
  });

  // Use shared canonical mock session for API responses
  const mockSession = createMockSession();

  // Mock Supabase auth endpoints - must match exact patterns
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
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

  // Also catch any remaining Supabase requests (including subdomains)
  // Return standard Supabase response shape to prevent client parsing errors
  await page.route('**/*supabase.co/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, error: null }),
    });
  });
}
