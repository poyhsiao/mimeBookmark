import type { IdentifyUserOptions } from '@/types/analytics';
import { ensureUmami } from './utils';

export function identifyUser({ userId, userData }: IdentifyUserOptions): void {
  const umami = ensureUmami();
  if (umami) {
    umami.identify(userId, userData as Record<string, string | number | boolean>);
  }
}
