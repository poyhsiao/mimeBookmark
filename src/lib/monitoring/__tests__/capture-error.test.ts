import { describe, expect, test } from 'vitest';
import { captureError, captureErrorMessage } from '@/lib/monitoring/capture-error';
import { captureMessage } from '@/lib/monitoring/capture-message';
import { setUser } from '@/lib/monitoring/set-user';
import { addBreadcrumb, createBreadcrumb } from '@/lib/monitoring/add-breadcrumb';

describe('capture-error', () => {
  describe('captureError', () => {
    test('returns event id when DSN is configured', () => {
      const error = new Error('Test error');
      const result = captureError({ error });

      expect(result).toBeTruthy();
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
  });

  describe('captureErrorMessage', () => {
    test('creates an error object from message', () => {
      const result = captureErrorMessage('Test error message');

      expect(typeof result).toBe('string');
    });
  });
});

describe('capture-message', () => {
  describe('captureMessage', () => {
    test('returns result from Sentry.captureMessage', () => {
      const result = captureMessage({ message: 'Test message' });

      expect(result).toBeTruthy();
    });

    test('handles different message levels', () => {
      expect(captureMessage({ message: 'Info', level: 'info' })).toBeTruthy();
      expect(captureMessage({ message: 'Warning', level: 'warning' })).toBeTruthy();
      expect(captureMessage({ message: 'Error', level: 'error' })).toBeTruthy();
      expect(captureMessage({ message: 'Debug', level: 'debug' })).toBeTruthy();
    });

    test('handles message with tags', () => {
      const result = captureMessage({
        message: 'Test',
        tags: { feature: 'test' },
      });

      expect(result).toBeTruthy();
    });

    test('handles message with extra data', () => {
      const result = captureMessage({
        message: 'Test',
        extra: { key: 'value' },
      });

      expect(result).toBeTruthy();
    });
  });
});

describe('set-user', () => {
  describe('setUser', () => {
    test('sets user context with valid user data', () => {
      expect(() => setUser({
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      })).not.toThrow();
    });

    test('sets user context with minimal data', () => {
      expect(() => setUser({ id: 'user-456' })).not.toThrow();
    });

    test('clears user context when null is passed', () => {
      expect(() => setUser(null)).not.toThrow();
    });

    test('handles user with extra properties', () => {
      expect(() => setUser({
        id: 'user-789',
        email: 'admin@example.com',
        role: 'admin',
      })).not.toThrow();
    });
  });
});

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
