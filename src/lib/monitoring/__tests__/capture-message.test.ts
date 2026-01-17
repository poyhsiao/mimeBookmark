import { describe, expect, test } from 'vitest';
import { captureMessage } from '@/lib/monitoring/capture-message';

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
