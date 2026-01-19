export interface UserContext {
  id: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}

export type BreadcrumbLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

export interface Breadcrumb {
  type?: 'default' | 'debug' | 'error' | 'navigation' | 'http' | 'info' | 'query' | 'transaction' | 'warning';
  category?: string;
  message: string;
  data?: Record<string, unknown>;
  level?: BreadcrumbLevel;
}

export interface MonitoringConfig {
  dsn?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

export interface ErrorMetadata {
  timestamp: string;
  path?: string;
  method?: string;
  userId?: string;
  requestId?: string;
  environment: string;
}
