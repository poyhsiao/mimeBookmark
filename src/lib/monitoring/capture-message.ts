import * as Sentry from '@sentry/nextjs';

export interface CaptureMessageOptions {
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export function captureMessage(options: CaptureMessageOptions): string | null {
  const { message, level = 'info', tags, extra } = options;

  const eventId = Sentry.captureMessage(message, {
    level,
    tags,
    extra,
  });

  return eventId;
}

export default captureMessage;
