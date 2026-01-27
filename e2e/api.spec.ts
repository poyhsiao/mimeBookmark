import { test, expect } from '@playwright/test';

// Skip auth tests in E2E mock mode since auth is bypassed
const shouldSkipAuthTests = process.env.E2E_USE_MOCK === 'true';

test.describe('API Endpoints', () => {
  test('should return 401 for unauthenticated requests to /api/tags', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.get('/api/tags');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/bookmarks', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.get('/api/bookmarks');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/collections', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.get('/api/collections');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/me/settings', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.get('/api/me/settings');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/me/stats', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.get('/api/me/stats');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/search', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.get('/api/search');
    expect(response.status()).toBe(401);
  });
});

test.describe('API - Tags Endpoint', () => {
  test('POST /api/tags should return 401 for unauthenticated requests', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.post('/api/tags', {
      data: { name: 'Test Tag', color: '#6B7280' }
    });
    expect(response.status()).toBe(401);
  });

  test('PUT /api/tags/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.put('/api/tags/some-id', {
      data: { name: 'Updated Tag', color: '#6B7280' }
    });
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/tags/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    test.skip(shouldSkipAuthTests, 'Auth tests skipped in E2E mock mode');
    const response = await request.delete('/api/tags/some-id');
    expect(response.status()).toBe(401);
  });
});
