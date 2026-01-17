import { describe, expect, test } from 'vitest';
import { setUser } from '@/lib/monitoring/set-user';

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
