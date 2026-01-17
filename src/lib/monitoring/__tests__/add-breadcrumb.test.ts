import { describe, expect, test } from 'vitest';
import { addBreadcrumb, createBreadcrumb } from '@/lib/monitoring/add-breadcrumb';

describe('add-breadcrumb', () => {
  describe('addBreadcrumb', () => {
    test('adds a breadcrumb with default options', () => {
      expect(() => addBreadcrumb({
        message: 'User clicked button',
        category: 'interaction',
      })).not.toThrow();
    });

    test('adds a breadcrumb with custom type', () => {
      expect(() => addBreadcrumb({
        message: 'Page viewed',
        category: 'navigation',
        type: 'navigation',
      })).not.toThrow();
    });

    test('adds a breadcrumb with custom level', () => {
      expect(() => addBreadcrumb({
        message: 'API request failed',
        category: 'http',
        level: 'error',
      })).not.toThrow();
    });

    test('adds a breadcrumb with data', () => {
      expect(() => addBreadcrumb({
        message: 'Bookmark created',
        category: 'bookmark',
        data: {
          bookmarkId: 'bm-123',
          url: 'https://example.com',
        },
      })).not.toThrow();
    });

    test('adds a breadcrumb with all options', () => {
      expect(() => addBreadcrumb({
        type: 'http',
        category: 'api',
        message: 'GET /api/bookmarks',
        data: { statusCode: 200, duration: 150 },
        level: 'debug',
      })).not.toThrow();
    });
  });

  describe('createBreadcrumb', () => {
    test('creates a breadcrumb with default type', () => {
      const breadcrumb = createBreadcrumb('interaction', 'User clicked save');

      expect(breadcrumb).toEqual({
        type: 'default',
        category: 'interaction',
        message: 'User clicked save',
        data: undefined,
      });
    });

    test('creates a breadcrumb with custom type', () => {
      const breadcrumb = createBreadcrumb('navigation', 'Navigated to collections', undefined, 'navigation');

      expect(breadcrumb.type).toBe('navigation');
    });

    test('creates a breadcrumb with data', () => {
      const breadcrumb = createBreadcrumb(
        'bookmark',
        'Bookmark deleted',
        { bookmarkId: 'bm-999' }
      );

      expect(breadcrumb.data).toEqual({ bookmarkId: 'bm-999' });
    });

    test('creates a breadcrumb with all parameters', () => {
      const breadcrumb = createBreadcrumb(
        'auth',
        'User logged in',
        { method: 'email' },
        'default'
      );

      expect(breadcrumb).toEqual({
        type: 'default',
        category: 'auth',
        message: 'User logged in',
        data: { method: 'email' },
      });
    });
  });
});
