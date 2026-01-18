'use client';

import { useCallback } from 'react';
import { trackEvent as trackEventFn, trackPageView as trackPageViewFn, identifyUser as identifyUserFn } from '@/lib/analytics';
import type { AnalyticsEvent, TrackEventOptions, IdentifyUserOptions, PageViewOptions } from '@/types/analytics';

export function useAnalytics() {
  const track = useCallback((eventName: AnalyticsEvent, eventData?: Record<string, string | number | boolean>) => {
    trackEventFn({ eventName, eventData });
  }, []);

  const trackPageView = useCallback((url: string, referrer?: string) => {
    trackPageViewFn({ url, referrer });
  }, []);

  const identify = useCallback((userId: string, userData?: { name?: string; email?: string; [key: string]: string | number | boolean | undefined }) => {
    identifyUserFn({ userId, userData });
  }, []);

  const trackBookmarkCreate = useCallback((bookmarkId: string, url: string) => {
    trackEventFn({ eventName: 'bookmark.create', eventData: { bookmarkId, url } });
  }, []);

  const trackBookmarkDelete = useCallback((bookmarkId: string) => {
    trackEventFn({ eventName: 'bookmark.delete', eventData: { bookmarkId } });
  }, []);

  const trackCollectionCreate = useCallback((collectionId: string, name: string) => {
    trackEventFn({ eventName: 'collection.create', eventData: { collectionId, name } });
  }, []);

  const trackCollectionDelete = useCallback((collectionId: string) => {
    trackEventFn({ eventName: 'collection.delete', eventData: { collectionId } });
  }, []);

  const trackSearch = useCallback((query: string, resultsCount: number) => {
    trackEventFn({ eventName: 'search.execute', eventData: { query, resultsCount } });
  }, []);

  return {
    track,
    trackPageView,
    identify,
    trackBookmarkCreate,
    trackBookmarkDelete,
    trackCollectionCreate,
    trackCollectionDelete,
    trackSearch,
  };
}
