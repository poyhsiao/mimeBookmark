import type { PageViewOptions } from '@/types/analytics';
import { ensureUmami } from './utils';

export function trackPageView({ url, referrer }: PageViewOptions): void {
  const umami = ensureUmami();
  if (umami) {
    const data: Record<string, string | number | boolean> = { url };
    if (referrer) {
      data.referrer = referrer;
    }
    umami.track(url, data);
  }
}
