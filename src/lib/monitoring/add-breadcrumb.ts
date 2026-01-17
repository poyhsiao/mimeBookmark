import * as Sentry from '@sentry/nextjs';

export interface Breadcrumb {
  type?: 'default' | 'debug' | 'error' | 'navigation' | 'http' | 'info' | 'query' | 'transaction' | 'warning';
  category?: string;
  message: string;
  data?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
}

export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  Sentry.addBreadcrumb({
    type: breadcrumb.type,
    category: breadcrumb.category,
    message: breadcrumb.message,
    data: breadcrumb.data,
    level: breadcrumb.level || 'info',
  });
}

export function createBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  type: Breadcrumb['type'] = 'default'
): Breadcrumb {
  return {
    type,
    category,
    message,
    data,
  };
}

export default addBreadcrumb;
