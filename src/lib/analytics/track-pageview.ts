import type { PageViewOptions } from '@/types/analytics';

export function trackPageView({ url, referrer }: PageViewOptions): void {
  if (typeof window !== 'undefined' && window.umami) {
    const data: Record<string, string | number | boolean> = { url };
    if (referrer) {
      data.referrer = referrer;
    }
    window.umami.track(url, data);
  }
}
