import type { TrackEventOptions } from '@/types/analytics';

export function trackEvent({ eventName, eventData }: TrackEventOptions): void {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.track(eventName, eventData);
  }
}
