import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

const tracesSampleRate = process.env.NODE_ENV === 'production' ? 0.1 : 1.0;

Sentry.init({
  ...(SENTRY_DSN && {
    dsn: SENTRY_DSN,
  }),
  tracesSampleRate,
  debug: process.env.NODE_ENV === 'development',
  maxBreadcrumbs: 50,
  attachStacktrace: true,
});
