import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test('should return 401 for unauthenticated requests to /api/tags', async ({ request }) => {
    const response = await request.get('/api/tags');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/bookmarks', async ({ request }) => {
    const response = await request.get('/api/bookmarks');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/collections', async ({ request }) => {
    const response = await request.get('/api/collections');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/me/settings', async ({ request }) => {
    const response = await request.get('/api/me/settings');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/me/stats', async ({ request }) => {
    const response = await request.get('/api/me/stats');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for unauthenticated requests to /api/search', async ({ request }) => {
    const response = await request.get('/api/search');
    expect(response.status()).toBe(401);
  });
});

test.describe('API - Tags Endpoint', () => {
  test('POST /api/tags should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/tags', {
      data: { name: 'Test Tag', color: '#6B7280' }
    });
    expect(response.status()).toBe(401);
  });

  test('PUT /api/tags/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.put('/api/tags/test-id', {
      data: { name: 'Updated Tag', color: '#EF4444' }
    });
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/tags/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.delete('/api/tags/test-id');
    expect(response.status()).toBe(401);
  });
});

test.describe('API - Bookmarks Endpoint', () => {
  test('POST /api/bookmarks should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/bookmarks', {
      data: { url: 'https://example.com', title: 'Example' }
    });
    expect(response.status()).toBe(401);
  });

  test('PUT /api/bookmarks/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.put('/api/bookmarks/test-id', {
      data: { title: 'Updated Title' }
    });
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/bookmarks/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.delete('/api/bookmarks/test-id');
    expect(response.status()).toBe(401);
  });
});

test.describe('API - Collections Endpoint', () => {
  test('POST /api/collections should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/collections', {
      data: { name: 'Test Collection' }
    });
    expect(response.status()).toBe(401);
  });

  test('PUT /api/collections/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.put('/api/collections/test-id', {
      data: { name: 'Updated Collection' }
    });
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/collections/[id] should return 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.delete('/api/collections/test-id');
    expect(response.status()).toBe(401);
  });
});
