import { describe, expect, test } from 'vitest';
import { captureMessage } from '../capture-message';

describe('captureMessage', () => {
  test('should handle various message lengths', () => {
    const messages = ['', 'short', 'A'.repeat(100), 'A'.repeat(10000)];

    messages.forEach((message) => {
      expect(() => {
        captureMessage({ message });
      }).not.toThrow();
    });
  });

  test('should handle all severity levels', () => {
    const levels = ['fatal', 'error', 'warning', 'log', 'info', 'debug'] as const;

    levels.forEach((level) => {
      expect(() => {
        captureMessage({ message: 'test', level });
      }).not.toThrow();
    });
  });

  test('should handle empty and complex tags objects', () => {
    const tagsArray = [
      {},
      { key: 'value' },
      { multiple: 'tags', another: 'tag', number: 123 },
    ];

    tagsArray.forEach((tags) => {
      expect(() => {
        captureMessage({ message: 'test', tags });
      }).not.toThrow();
    });
  });

  test('should handle empty and complex extra objects', () => {
    const extraArray = [
      {},
      { key: 'value' },
      { nested: { deep: true }, array: [1, 2, 3] },
      { nullValue: null, undefinedValue: undefined },
    ];

    extraArray.forEach((extra) => {
      expect(() => {
        captureMessage({ message: 'test', extra });
      }).not.toThrow();
    });
  });

  test('should handle special characters in message', () => {
    const specialMessages = [
      'Error: "Failed"',
      'Line 10\tColumn 5',
      'New\nline\r\ntest',
      'Unicode: 你好 🚀',
      'Emoji: 🎉🎊🎈',
    ];

    specialMessages.forEach((message) => {
      expect(() => {
        captureMessage({ message });
      }).not.toThrow();
    });
  });
});
