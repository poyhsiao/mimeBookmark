declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, string | number | boolean>) => void;
      identify: (userId: string, userData?: Record<string, string | number | boolean>) => void;
    };
  }
}

export {};
