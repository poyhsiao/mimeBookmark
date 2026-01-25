import { test, expect } from '@playwright/test';
import { authenticateUser } from './fixtures/auth';

test.describe('API Security - Authentication', () => {
  test('sync API requires authentication', async ({ page }) => {
    const response = await page.request.get('/api/extensions/sync');
    expect(response.status()).not.toBe(200);
  });

  test('batch-save API requires authentication', async ({ page }) => {
    const response = await page.request.post('/api/extensions/batch-save', {
      data: { tabs: [] },
    });
    expect(response.status()).not.toBe(200);
  });

  test('extension search API requires authentication', async ({ page }) => {
    const response = await page.request.get('/api/extensions/search?q=test');
    expect(response.status()).toBe(401);
  });

  test('recommendations search API requires authentication', async ({ page }) => {
    const response = await page.request.get('/api/recommendations/search?query=test');
    expect(response.status()).not.toBe(200);
  });

  test('recommendations analytics API requires authentication', async ({ page }) => {
    const response = await page.request.get('/api/recommendations/analytics');
    expect(response.status()).not.toBe(200);
  });

  test('recommendations rules API requires authentication', async ({ page }) => {
    const response = await page.request.get('/api/recommendations/rules');
    expect(response.status()).not.toBe(200);
  });
});

test.describe('API Structure - Response Format', () => {
  test('recommendations search returns valid structure when authenticated', async ({ page }) => {
    // Use authenticateUser fixture to get real session
    await authenticateUser(page);

    const response = await page.request.get('/api/recommendations/search?query=javascript');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('query');
    expect(data).toHaveProperty('recommendations');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  test('search query length validation', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.get('/api/recommendations/search?query=a');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.recommendations).toEqual([]);
  });

  test('extension search returns valid structure', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.get('/api/extensions/search?q=test&limit=5');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('query');
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('suggestions');
    expect(Array.isArray(data.results)).toBe(true);
  });
});

test.describe('Extension API - Request Validation', () => {
  test('batch-save handles array of tabs', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.post('/api/extensions/batch-save', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        tabs: [
          { url: 'https://example1.com', title: 'Example 1' },
          { url: 'https://example2.com', title: 'Example 2' },
        ],
      },
    });

    expect(response.status()).toBe(200);
  });

  test('batch-save handles optional collectionId', async ({ page }) => {
    await authenticateUser(page);

    // Test without collectionId - should succeed
    const response = await page.request.post('/api/extensions/batch-save', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        tabs: [{ url: 'https://example.com', title: 'Example' }],
        // collectionId omitted - bookmarks saved without collection assignment
      },
    });

    expect(response.status()).toBe(200);
  });

  test('batch-save handles optional tags', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.post('/api/extensions/batch-save', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        tabs: [{ url: 'https://example.com', title: 'Example' }],
        tags: ['imported', 'extension'],
      },
    });

    expect(response.status()).toBe(200);
  });

  test('extension search accepts type filter', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.get('/api/extensions/search?q=test&type=bookmark');

    expect(response.status()).toBe(200);
  });

  test('extension search accepts limit parameter', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.get('/api/extensions/search?q=test&limit=10');

    expect(response.status()).toBe(200);
  });

  test('sync API accepts since parameter', async ({ page }) => {
    await authenticateUser(page);

    const timestamp = new Date(Date.now() - 3600000).toISOString();
    const response = await page.request.get(`/api/extensions/sync?since=${encodeURIComponent(timestamp)}`);

    expect(response.status()).toBe(200);
  });
});

test.describe('API Content Type', () => {
  test('responses contain JSON content-type', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.get('/api/extensions/search?q=test');

    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('recommendations search responses contain JSON', async ({ page }) => {
    await authenticateUser(page);

    const response = await page.request.get('/api/recommendations/search?query=test');

    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });
});
