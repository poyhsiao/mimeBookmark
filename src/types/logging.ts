export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  service?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
}

export interface LogTransport {
  name: string;
  log(entry: LogEntry): Promise<void> | void;
  flush?(): Promise<void> | void;
  close?(): Promise<void> | void;
}

export interface LoggerOptions {
  level: LogLevel;
  service: string;
  transports: LogTransport[];
  environment?: string;
  version?: string;
}

export interface LokiConfig {
  url: string;
  username?: string;
  password?: string;
  tenantId?: string;
  batchSize?: number;
  flushInterval?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  compressionEnabled?: boolean;
}

export interface ConsoleTransportOptions {
  format: 'json' | 'human';
  colors?: boolean;
}

export const LOG_LEVELS: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

export function isLevelEnabled(
  currentLevel: LogLevel,
  targetLevel: LogLevel
): boolean {
  return LOG_LEVELS[currentLevel] >= LOG_LEVELS[targetLevel];
}
