import { test, expect } from '@playwright/test';
import { authenticateUser } from './fixtures/auth';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test.describe('Search in Bookmarks', () => {
    test.beforeEach(async ({ page }) => {
      // Set up route mocks before navigation to prevent race conditions
      await page.route('**/api/bookmarks', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bookmarks: [
              { id: '1', url: 'https://example.com', title: 'Developer Guide' },
              { id: '2', url: 'https://test.com', title: 'Testing Tutorial' },
            ],
            total: 2,
          }),
        });
      });
      await page.goto('/dashboard/bookmarks');
    });

    test('should search bookmarks by title', async ({ page }) => {
      // Bookmarks route is already mocked in beforeEach

      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query === 'Developer') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bookmarks: [{ id: '1', url: 'https://example.com', title: 'Developer Guide' }],
              total: 1,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ bookmarks: [], total: 0 }),
          });
        }
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('Developer');

      await expect(page.locator('text=Developer Guide')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Testing Tutorial')).not.toBeVisible();
    });

    test('should search bookmarks by tag', async ({ page }) => {
      await page.route('**/api/bookmarks', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bookmarks: [
              { id: '1', url: 'https://example.com', title: 'React Tutorial', tags: ['react'] },
              { id: '2', url: 'https://test.com', title: 'Vue Guide', tags: ['vue'] },
            ],
            total: 2,
          }),
        });
      });

      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query === 'react') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bookmarks: [{ id: '1', url: 'https://example.com', title: 'React Tutorial', tags: ['react'] }],
              total: 1,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ bookmarks: [], total: 0 }),
          });
        }
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('react');

      await expect(page.locator('text=React Tutorial')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Vue Guide')).not.toBeVisible({ timeout: 10000 });
    });

    test('should show no results for empty search', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookmarks: [], total: 0 }),
        });
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('nonexistent');

      const emptyMessage = page.locator('text=No results found').or(page.locator('text="No bookmarks match your search."')).first();
      await expect(emptyMessage).toBeVisible({ timeout: 10000 });
    });

    test('should filter bookmarks by collection', async ({ page }) => {
      await page.route('**/api/bookmarks', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bookmarks: [
              { id: '1', url: 'https://example.com', title: 'Bookmark 1', collections: ['tech'] },
              { id: '2', url: 'https://test.com', title: 'Bookmark 2', collections: ['design'] },
            ],
            total: 2,
          }),
        });
      });

      await page.route('**/api/collections', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            collections: [
              { id: 'tech', name: 'tech' },
              { id: 'design', name: 'design' },
            ],
            pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
          }),
        });
      });

      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const collection = url.searchParams.get('collection_id');
        if (collection === 'tech') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bookmarks: [{ id: '1', url: 'https://example.com', title: 'Bookmark 1', collections: ['tech'] }],
              total: 1,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ bookmarks: [], total: 0 }),
          });
        }
      });

      await page.reload();
      const filterSelect = page.locator('select').first();
      await filterSelect.selectOption('tech');

      await expect(page.locator('text=Bookmark 1')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Bookmark 2')).not.toBeVisible({ timeout: 10000 });
    });

    test('should be case-insensitive', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query && query.toLowerCase() === 'developer') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bookmarks: [{ id: '1', url: 'https://example.com', title: 'Developer Guide' }],
              total: 1,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ bookmarks: [], total: 0 }),
          });
        }
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('DEVELOPER');

      await expect(page.locator('text=Developer Guide')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Search in Collections', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/collections', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            collections: [
              { id: '1', name: 'Tech Resources', description: 'Developer tools' },
              { id: '2', name: 'Design Assets', description: 'Design resources' },
            ],
            total: 2,
          }),
        });
      });
      await page.goto('/dashboard/collections');
    });

    test('should search collections by name', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query === 'Tech') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              collections: [{ id: '1', name: 'Tech Resources', description: 'Developer tools' }],
              total: 1,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ collections: [], total: 0 }),
          });
        }
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('Tech');

      await expect(page.locator('text=Tech Resources')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Design Assets')).not.toBeVisible({ timeout: 10000 });
    });

    test('should show empty state for no results', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ collections: [], total: 0 }),
        });
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('nonexistent');

      const emptyMessage = page.locator('text=No collections found').or(page.locator('text="No results"')).first();
      await expect(emptyMessage).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Search in Tags', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/tags', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tags: [
              { id: '1', name: 'javascript' },
              { id: '2', name: 'typescript' },
            ],
            total: 2,
          }),
        });
      });
      await page.goto('/dashboard/tags');
    });

    test('should search tags by name', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query === 'java') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              tags: [{ id: '1', name: 'javascript' }],
              total: 1,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ tags: [], total: 0 }),
          });
        }
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('java');

      await expect(page.locator('text=javascript')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=typescript')).not.toBeVisible({ timeout: 10000 });
    });

    test('should show empty state for no results', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tags: [], total: 0 }),
        });
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('nonexistent');

      const emptyMessage = page.locator('text=No tags found').or(page.locator('text="No results"')).first();
      await expect(emptyMessage).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Global Search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
    });

    test('should have global search accessible from navbar', async ({ page }) => {
      const searchButton = page.locator('button[aria-label*="Search"], button[title*="Search"]').or(page.locator('input[placeholder*="Search"]')).first();
      await expect(searchButton).toBeVisible({ timeout: 10000 });
    });

    test('should search across all entities', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query === 'test-search-query') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bookmarks: [{ id: '1', url: 'https://example.com', title: 'Test Bookmark' }],
              collections: [{ id: '1', name: 'Test Collection' }],
              tags: [{ id: '1', name: 'test-search-query' }],
              total: 3,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ bookmarks: [], collections: [], tags: [], total: 0 }),
          });
        }
      });

      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('test-search-query');

      await expect(page.locator('text=Test Bookmark')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Test Collection')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="search-results"] >> text=test-search-query').or(page.locator('.search-results >> text=test-search-query')).or(page.locator('[role="list"] >> text=test-search-query')).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Search Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/bookmarks', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bookmarks: [
              { id: '1', url: 'https://example.com', title: 'Bookmark 1' },
            ],
            total: 1,
          }),
        });
      });
      await page.goto('/dashboard/bookmarks');
    });

    test('should handle special characters', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookmarks: [], total: 0 }),
        });
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('@#$%^&*()');

      await expect(searchInput).toHaveValue('@#$%^&*()');
    });

    test('should handle emoji in search', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query && query.includes('🚀')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bookmarks: [{ id: '1', url: 'https://example.com', title: 'Rocket Launch 🚀' }],
              total: 1,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ bookmarks: [], total: 0 }),
          });
        }
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('🚀');

      await expect(page.locator('text=Rocket Launch 🚀')).toBeVisible({ timeout: 10000 });
    });

    test('should handle URL-encoded characters', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookmarks: [], total: 0 }),
        });
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('test%20query');

      await expect(searchInput).toHaveValue('test%20query');
    });

    test('should handle very long search queries', async ({ page }) => {
      const longQuery = 'a'.repeat(1000);

      await page.route('**/api/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookmarks: [], total: 0 }),
        });
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill(longQuery);

      await expect(searchInput).toHaveValue(longQuery);
    });

    test('should clear search results', async ({ page }) => {
      await page.route('**/api/search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookmarks: [], total: 0 }),
        });
      });

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      await searchInput.fill('test');

      await page.keyboard.press('Escape');

      await expect(searchInput).toHaveValue('');
      await expect(page.locator('text=Bookmark 1')).toBeVisible({ timeout: 10000 });
    });
  });
});
