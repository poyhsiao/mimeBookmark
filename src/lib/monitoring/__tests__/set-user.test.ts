import { describe, expect, test } from 'vitest';
import { setUser, UserContext } from '../set-user';

describe('setUser', () => {
  test('should handle null user', () => {
    expect(() => {
      setUser(null);
    }).not.toThrow();
  });

  test('should handle various user object shapes', () => {
    const userObjects: UserContext[] = [
      { id: '1' },
      { id: '2', email: 'test@example.com' },
      { id: '3', email: 'test@example.com', username: 'testuser' },
      { id: '4', email: undefined, username: undefined },
      { id: '5', role: 'admin' as const, subscription: 'pro' },
    ];

    userObjects.forEach((user) => {
      expect(() => {
        setUser(user);
      }).not.toThrow();
    });
  });

  test('should handle user with special characters', () => {
    const specialUsers: UserContext[] = [
      { id: 'user@example.com', email: 'test@example.com' },
      { id: 'user-name', email: 'test@example.com' },
      { id: '用户', email: 'test@example.com' },
      { id: '🚀', email: 'test@example.com' },
    ];

    specialUsers.forEach((user) => {
      expect(() => {
        setUser(user);
      }).not.toThrow();
    });
  });

  test('should handle multiple sequential calls', () => {
    expect(() => {
      setUser({ id: '1' });
      setUser({ id: '2' });
      setUser(null);
    }).not.toThrow();
  });

  test('should handle rapid successive calls', () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        setUser({ id: String(i) });
      }
    }).not.toThrow();
  });
});
