import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { trackEvent } from '../track-event';

describe('trackEvent', () => {
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
      trackEvent({ eventName: 'user.login' });
    }).not.toThrow();
    
    global.window = originalWindow;
  });

  test('should call umami.track with event name only', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    trackEvent({ eventName: 'user.login' });
    
    expect(mockTrack).toHaveBeenCalledWith('user.login', undefined);
  });

  test('should call umami.track with event name and data', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    trackEvent({ 
      eventName: 'bookmark.create', 
      eventData: { bookmarkId: '123', url: 'https://example.com' } 
    });
    
    expect(mockTrack).toHaveBeenCalledWith('bookmark.create', { bookmarkId: '123', url: 'https://example.com' });
  });

  test('should handle all event types', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    const eventTypes = [
      'user.signup',
      'user.login',
      'bookmark.create',
      'bookmark.delete',
      'bookmark.import',
      'bookmark.export',
      'collection.create',
      'collection.delete',
      'tag.create',
      'search.execute',
      'settings.update',
    ];
    
    eventTypes.forEach((eventName) => {
      expect(() => {
        trackEvent({ eventName: eventName as any });
      }).not.toThrow();
    });
  });

  test('should handle complex event data', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    const complexData = {
      count: 10,
      isActive: true,
      name: 'test',
      ratio: 0.5,
    };
    
    trackEvent({ eventName: 'search.execute', eventData: complexData });
    
    expect(mockTrack).toHaveBeenCalledWith('search.execute', complexData);
  });
});
