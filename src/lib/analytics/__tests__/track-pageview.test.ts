import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { trackPageView } from '../track-pageview';

describe('trackPageView', () => {
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
      trackPageView({ url: 'https://example.com' });
    }).not.toThrow();
    
    global.window = originalWindow;
  });

  test('should call umami.track with url only', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    trackPageView({ url: 'https://example.com' });
    
    expect(mockTrack).toHaveBeenCalledWith('https://example.com', { url: 'https://example.com' });
  });

  test('should call umami.track with url and referrer', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    trackPageView({ url: 'https://example.com/page', referrer: 'https://google.com' });
    
    expect(mockTrack).toHaveBeenCalledWith('https://example.com/page', {
      url: 'https://example.com/page',
      referrer: 'https://google.com'
    });
  });

  test('should handle various URL formats', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    const urls = [
      'https://example.com',
      'https://example.com/path/to/page',
      'https://example.com/path?query=value',
      'https://example.com/path#hash',
      '/relative/path',
      'http://localhost:3000',
    ];
    
    urls.forEach((url) => {
      expect(() => {
        trackPageView({ url });
      }).not.toThrow();
    });
  });

  test('should handle long URLs', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    const longUrl = 'https://example.com/' + 'a'.repeat(1000);
    trackPageView({ url: longUrl });
    
    expect(mockTrack).toHaveBeenCalledWith(longUrl, { url: longUrl });
  });

  test('should handle URLs with special characters', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    const url = 'https://example.com/search?q=hello world&category=test%20case';
    trackPageView({ url });
    
    expect(mockTrack).toHaveBeenCalledWith(url, { url });
  });

  test('should not include falsy referrer values', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    trackPageView({ url: 'https://example.com', referrer: '' });
    
    const callArgs = mockTrack.mock.calls[0];
    expect(callArgs[1]).not.toHaveProperty('referrer');
  });

  test('should not include undefined referrer in data', () => {
    const mockTrack = vi.fn();
    (global as any).window = { umami: { track: mockTrack } };
    
    trackPageView({ url: 'https://example.com' });
    
    const callArgs = mockTrack.mock.calls[0];
    expect(callArgs[1]).not.toHaveProperty('referrer');
  });
});
