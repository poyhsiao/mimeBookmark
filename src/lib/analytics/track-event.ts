import type { TrackEventOptions } from '@/types/analytics';
import { ensureUmami } from './utils';

export function trackEvent({ eventName, eventData }: TrackEventOptions): void {
  const umami = ensureUmami();
  if (umami) {
    umami.track(eventName, eventData);
  }
}
