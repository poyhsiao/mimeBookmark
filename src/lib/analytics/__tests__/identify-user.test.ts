import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { identifyUser } from '../identify-user';

describe('identifyUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should not throw when window.umami is undefined', () => {
    const originalWindow = global.window;
    delete (global as any).window;
    
    expect(() => {
      identifyUser({ userId: '123' });
    }).not.toThrow();
    
    global.window = originalWindow;
  });

  test('should call umami.identify with user id only', () => {
    const mockIdentify = vi.fn();
    (global as any).window = { umami: { identify: mockIdentify } };
    
    identifyUser({ userId: 'user-123' });
    
    expect(mockIdentify).toHaveBeenCalledWith('user-123', undefined);
  });

  test('should call umami.identify with user id and user data', () => {
    const mockIdentify = vi.fn();
    (global as any).window = { umami: { identify: mockIdentify } };
    
    identifyUser({ 
      userId: 'user-123', 
      userData: { name: 'John Doe', email: 'john@example.com' } 
    });
    
    expect(mockIdentify).toHaveBeenCalledWith('user-123', { name: 'John Doe', email: 'john@example.com' });
  });

  test('should handle various user data types', () => {
    const mockIdentify = vi.fn();
    (global as any).window = { umami: { identify: mockIdentify } };
    
    const userData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      subscriptionTier: 'pro',
      bookmarksCount: 100,
      isVerified: true,
    };
    
    identifyUser({ userId: 'user-456', userData });
    
    expect(mockIdentify).toHaveBeenCalledWith('user-456', userData);
  });

  test('should handle special characters in user data', () => {
    const mockIdentify = vi.fn();
    (global as any).window = { umami: { identify: mockIdentify } };
    
    identifyUser({ 
      userId: 'user-789', 
      userData: { 
        name: 'User with spaces',
        email: 'user+test@example.com' 
      } 
    });
    
    expect(mockIdentify).toHaveBeenCalledWith('user-789', { 
      name: 'User with spaces',
      email: 'user+test@example.com' 
    });
  });
});
