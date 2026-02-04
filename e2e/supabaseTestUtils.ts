import type { Page, BrowserContext } from '@playwright/test';
import { createMockSession } from './fixtures/auth';

/**
 * Extracts Supabase project ref from environment variable
 * @param url - Supabase URL (defaults to NEXT_PUBLIC_SUPABASE_URL env var)
 * @returns Project ref or 'local' as fallback
 */
export function getSupabaseProjectRef(url = process.env.NEXT_PUBLIC_SUPABASE_URL || '') {
  let projectRef = 'local';

  if (!url) return projectRef;

  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/^([^.]+)\.supabase\.co$/);
    if (match) projectRef = match[1];
  } catch {
    // keep default 'local'
  }

  return projectRef;
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
 * Sets up mock Supabase authentication for E2E tests
 * Injects mock session into localStorage and sets cookies for middleware bypass
 * @param page - Playwright Page instance
 */
export async function setupMockSupabaseAuth(page: Page) {
  const mockSession = createMockSession();
  const projectRef = getSupabaseProjectRef();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const cookieDomain = getCookieDomain();
  const context: BrowserContext = page.context();

  await page.addInitScript(
    ({ projectRef, mockSession }) => {
      const storageKey = `sb-${projectRef}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify(mockSession));

      const oldStorageKey = `sb-${projectRef}-auth-token-code-verifier`;
      localStorage.setItem(oldStorageKey, '');

      localStorage.setItem('e2e-test-mode', 'true');
    },
    { projectRef, mockSession }
  );

  // For localhost, use url; for production, use domain/path
  const cookieOptions = cookieDomain
    ? { domain: cookieDomain, path: '/' }
    : { url: baseUrl };

  await context.addCookies([
    {
      name: 'e2e-test-mode',
      value: 'true',
      sameSite: 'Lax' as const,
      ...cookieOptions,
    },
    {
      name: `sb-${projectRef}-auth-token-code-verifier`,
      value: '',
      sameSite: 'Lax' as const,
      ...cookieOptions,
    },
  ]);

  // Route registration order encapsulated here
  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          session: mockSession,
          user: mockSession.user,
        },
      }),
    })
  );

  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: mockSession.user,
        },
      }),
    })
  );

  await page.route('**/auth/v1/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          session: mockSession,
        },
      }),
    })
  );
}
