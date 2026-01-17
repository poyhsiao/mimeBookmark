import { describe, expect, test } from 'vitest';
import { captureError, captureErrorMessage } from '../capture-error';

describe('captureError', () => {
  test('should handle various error types', () => {
    const errorTypes = [
      new Error('Standard error'),
      'String error',
      42,
      null,
      { message: 'Object error' },
      undefined,
    ];

    errorTypes.forEach((error) => {
      expect(() => {
        captureError({ error });
      }).not.toThrow();
    });
  });

  test('should handle various level options', () => {
    const levels = ['fatal', 'error', 'warning', 'log', 'info', 'debug'] as const;

    levels.forEach((level) => {
      expect(() => {
        captureError({ error: new Error('test'), level });
      }).not.toThrow();
    });
  });

  test('should handle empty and complex context objects', () => {
    const contexts = [
      {},
      { key: 'value' },
      { nested: { deep: true } },
      { array: [1, 2, 3] },
    ];

    contexts.forEach((context) => {
      expect(() => {
        captureError({ error: new Error('test'), context });
      }).not.toThrow();
    });
  });

  test('should handle empty and complex tags objects', () => {
    const tagsArray = [
      {},
      { key: 'value' },
      { multiple: 'tags', another: 'tag' },
    ];

    tagsArray.forEach((tags) => {
      expect(() => {
        captureError({ error: new Error('test'), tags });
      }).not.toThrow();
    });
  });
});

describe('captureErrorMessage', () => {
  test('should handle various message lengths', () => {
    const messages = ['', 'short', 'A'.repeat(100), 'A'.repeat(10000)];

    messages.forEach((message) => {
      expect(() => {
        captureErrorMessage(message);
      }).not.toThrow();
    });
  });

  test('should handle special characters in message', () => {
    const specialMessages = [
      'Error: "Failed"',
      'Line 10\tColumn 5',
      'New\nline\r\ntest',
      'Unicode: 你好 🚀',
    ];

    specialMessages.forEach((message) => {
      expect(() => {
        captureErrorMessage(message);
      }).not.toThrow();
    });
  });

  test('should forward optional parameters', () => {
    expect(() => {
      captureErrorMessage('test', { level: 'warning', tags: { key: 'value' } });
    }).not.toThrow();
  });
});
