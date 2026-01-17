import type { IdentifyUserOptions } from '@/types/analytics';

export function identifyUser({ userId, userData }: IdentifyUserOptions): void {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.identify(userId, userData as Record<string, string | number | boolean>);
  }
}
