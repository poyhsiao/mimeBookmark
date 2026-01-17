import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../track-event', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../track-pageview', () => ({
  trackPageView: vi.fn(),
}));

vi.mock('../identify-user', () => ({
  identifyUser: vi.fn(),
}));

import { trackEvent } from '../track-event';
import { trackPageView } from '../track-pageview';
import { identifyUser } from '../identify-user';
import { useAnalytics } from '../use-analytics';

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should return all tracking functions', () => {
    const { result } = renderHook(() => useAnalytics());
    
    expect(result.current).toHaveProperty('track');
    expect(result.current).toHaveProperty('trackPageView');
    expect(result.current).toHaveProperty('identify');
    expect(result.current).toHaveProperty('trackBookmarkCreate');
    expect(result.current).toHaveProperty('trackBookmarkDelete');
    expect(result.current).toHaveProperty('trackCollectionCreate');
    expect(result.current).toHaveProperty('trackCollectionDelete');
    expect(result.current).toHaveProperty('trackSearch');
  });

  test('should return functions that are defined', () => {
    const { result } = renderHook(() => useAnalytics());
    
    expect(typeof result.current.track).toBe('function');
    expect(typeof result.current.trackPageView).toBe('function');
    expect(typeof result.current.identify).toBe('function');
    expect(typeof result.current.trackBookmarkCreate).toBe('function');
    expect(typeof result.current.trackBookmarkDelete).toBe('function');
    expect(typeof result.current.trackCollectionCreate).toBe('function');
    expect(typeof result.current.trackCollectionDelete).toBe('function');
    expect(typeof result.current.trackSearch).toBe('function');
  });

  test('trackBookmarkCreate should call trackEvent with correct event name', () => {
    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.trackBookmarkCreate('bookmark-123', 'https://example.com');
    });
    
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'bookmark.create',
      eventData: { bookmarkId: 'bookmark-123', url: 'https://example.com' }
    });
  });

  test('trackBookmarkDelete should call trackEvent with correct event name', () => {
    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.trackBookmarkDelete('bookmark-456');
    });
    
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'bookmark.delete',
      eventData: { bookmarkId: 'bookmark-456' }
    });
  });

  test('trackCollectionCreate should call trackEvent with correct event name', () => {
    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.trackCollectionCreate('collection-789', 'My Collection');
    });
    
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'collection.create',
      eventData: { collectionId: 'collection-789', name: 'My Collection' }
    });
  });

  test('trackCollectionDelete should call trackEvent with correct event name', () => {
    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.trackCollectionDelete('collection-abc');
    });
    
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'collection.delete',
      eventData: { collectionId: 'collection-abc' }
    });
  });

  test('trackSearch should call trackEvent with correct event name', () => {
    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.trackSearch('test query', 10);
    });
    
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'search.execute',
      eventData: { query: 'test query', resultsCount: 10 }
    });
  });

  test('functions should be stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useAnalytics());
    const firstTrack = result.current.track;
    const firstTrackPageView = result.current.trackPageView;
    const firstIdentify = result.current.identify;
    
    rerender();
    
    expect(result.current.track).toBe(firstTrack);
    expect(result.current.trackPageView).toBe(firstTrackPageView);
    expect(result.current.identify).toBe(firstIdentify);
  });
});
