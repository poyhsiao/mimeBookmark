import * as Sentry from "@sentry/nextjs";

export interface CaptureErrorOptions {
  error: Error | unknown;
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
  level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
  extra?: Record<string, unknown>;
}

export function captureError(options: CaptureErrorOptions): string | null {
  const { error, context, tags, level = "error", extra } = options;

  const eventId = Sentry.captureException(error, {
    level,
    tags,
    extra: {
      ...context,
      ...extra,
    },
  });

  return eventId;
}

export function captureErrorMessage(
  message: string,
  options?: Omit<CaptureErrorOptions, "error">,
): string | null {
  const error = new Error(message);
  return captureError({
    error,
    ...options,
  });
}

export default captureError;
