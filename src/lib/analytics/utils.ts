export function ensureUmami(): { track: (eventName: string, eventData?: Record<string, string | number | boolean>) => void; identify: (userId: string, userData?: Record<string, string | number | boolean>) => void } | null {
  if (typeof window !== 'undefined' && (window as any).umami) {
    return (window as any).umami;
  }
  return null;
}
