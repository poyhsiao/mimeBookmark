import { describe, expect, test } from 'vitest';
import { createBreadcrumb } from '../add-breadcrumb';

describe('createBreadcrumb', () => {
  test('should create a breadcrumb object with required fields', () => {
    const breadcrumb = createBreadcrumb('navigation', 'User clicked link');

    expect(breadcrumb).toEqual({
      category: 'navigation',
      message: 'User clicked link',
      type: 'default',
    });
  });

  test('should include data when provided', () => {
    const breadcrumb = createBreadcrumb('http', 'API request', { method: 'GET', url: '/api/users' });

    expect(breadcrumb).toEqual({
      category: 'http',
      message: 'API request',
      type: 'default',
      data: { method: 'GET', url: '/api/users' },
    });
  });

  test('should use custom type when provided', () => {
    const breadcrumb = createBreadcrumb('navigation', 'Page view', undefined, 'navigation');

    expect(breadcrumb).toEqual({
      category: 'navigation',
      message: 'Page view',
      type: 'navigation',
    });
  });

  test('should handle complex data structures', () => {
    const complexData = {
      nested: { deep: { value: 42 } },
      array: [1, 2, 3],
    };

    const breadcrumb = createBreadcrumb('query', 'Search', complexData);

    expect(breadcrumb.data).toEqual(complexData);
  });

  test('should handle empty data object', () => {
    const breadcrumb = createBreadcrumb('info', 'Test', {});

    expect(breadcrumb.data).toEqual({});
  });

  test('should handle special characters in message', () => {
    const breadcrumb = createBreadcrumb('error', 'Error: "Failed" at line 10');

    expect(breadcrumb.message).toBe('Error: "Failed" at line 10');
  });

  test('should handle unicode characters', () => {
    const breadcrumb = createBreadcrumb('info', '测试消息 🚀');

    expect(breadcrumb.message).toBe('测试消息 🚀');
  });
});
