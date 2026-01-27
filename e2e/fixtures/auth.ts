import type { Page } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

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

export function getSupabaseProjectRef(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const match = hostname.match(/^([^.]+)\.supabase\.co$/);
    return match ? match[1] : 'local';
  } catch {
    return 'local';
  }
}

/**
 * Extracts cookie domain from base URL
 * @param baseUrl - Base URL (defaults to BASE_URL env var)
 * @returns Cookie domain for non-localhost URLs, undefined for localhost
 */
export function getCookieDomain(baseUrl = process.env.BASE_URL || 'http://localhost:3000') {
  try {
    const urlObj = new URL(baseUrl);
    if (urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
      return urlObj.hostname;
    }
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Injects mock session into localStorage
 * @param page - Playwright Page instance
 * @param projectRef - Supabase project ref
 * @param mockSession - Mock session object
 */
async function injectMockSession(page: Page, projectRef: string, mockSession: ReturnType<typeof createMockSession>) {
  await page.addInitScript(({ projectRef, mockSession }) => {
    const storageKey = `sb-${projectRef}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(mockSession));

    const oldKeys = Object.keys(localStorage);
    oldKeys.forEach(key => {
      if (key.startsWith(`sb-${projectRef}-`) && key !== storageKey) {
        localStorage.removeItem(key);
      }
    });
  }, { projectRef, mockSession });
}

/**
 * Sets test cookies for E2E mode
 * @param page - Playwright Page instance
 * @param cookieDomain - Cookie domain or undefined
 */
async function setupTestCookies(page: Page, cookieDomain: string | undefined) {
  const context: BrowserContext = page.context();
  await context.addCookies([
    {
      name: 'e2e-test-mode',
      value: 'true',
      domain: cookieDomain,
      path: '/',
      sameSite: 'Lax' as const,
    },
  ]);
}

/**
 * Mocks user-related API endpoints
 * @param page - Playwright Page instance
 */
async function mockUserEndpoints(page: Page) {
  await page.route('**/api/me/**', async route => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/settings')) {
      const body = {
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
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
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
}

/**
 * Mocks bookmarks-related API endpoints
 * @param page - Playwright Page instance
 */
async function mockBookmarkEndpoints(page: Page) {
  const fulfillEmptyBookmarks = async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookmarks: [], total: 0 }),
    });
  };
  await page.route('**/api/bookmarks', fulfillEmptyBookmarks);
  await page.route('**/api/bookmarks/**', fulfillEmptyBookmarks);
}

/**
 * Mocks collections-related API endpoints
 * @param page - Playwright Page instance
 */
async function mockCollectionEndpoints(page: Page) {
  const fulfillEmptyCollections = async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ collections: [], total: 0 }),
    });
  };
  await page.route('**/api/collections', fulfillEmptyCollections);
  await page.route('**/api/collections/**', fulfillEmptyCollections);
}

/**
 * Mocks tags-related API endpoints
 * @param page - Playwright Page Page instance
 */
async function mockTagEndpoints(page: Page) {
  const fulfillEmptyTags = async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tags: [], total: 0 }),
    });
  };
  await page.route('**/api/tags', fulfillEmptyTags);
  await page.route('**/api/tags/**', fulfillEmptyTags);
}



/**
 * Sets up mock authentication for E2E tests
 * @param page - Playwright Page instance
 */
async function setupMockAuth(page: Page): Promise<void> {
  const projectRef = getSupabaseProjectRef();
  const mockSession = createMockSession();

  await injectMockSession(page, projectRef, mockSession);
  await setupTestCookies(page, getCookieDomain());
  await setupAPIRoutes(page, mockSession);
}

/**
  * Mocks Supabase auth endpoints
 * @param page - Playwright Page instance
 * @param mockSession - Mock session object
 */
async function mockSupabaseAuth(page: Page, mockSession: ReturnType<typeof createMockSession>) {
  await page.route('**/auth/v1/**', async route => {
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

  await page.route('**/*supabase.co/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, error: null }),
    });
  });
}

/**
 * Sets up all API route mocks
 * @param page - Playwright Page instance
 * @param mockSession - Mock session object
 */
async function setupAPIRoutes(page: Page, mockSession: ReturnType<typeof createMockSession>) {
  await mockUserEndpoints(page);
  await mockBookmarkEndpoints(page);
  await mockCollectionEndpoints(page);
  await mockTagEndpoints(page);
  await mockSupabaseAuth(page, mockSession);
}

/**
 * Authenticates a user for E2E tests
 * @param page - Playwright Page instance
 */
export async function authenticateUser(page: Page): Promise<void> {
  await setupMockAuth(page);
}
