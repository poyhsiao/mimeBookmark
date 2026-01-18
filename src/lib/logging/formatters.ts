import type { LogEntry, LogLevel } from '@/types/logging';
import { LOG_LEVELS } from '@/types/logging';

export function formatAsJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export function formatAsHuman(entry: LogEntry): string {
  const { timestamp, level, message, service } = entry;
  const contextStr = entry.context
    ? ` ${JSON.stringify(entry.context)}`
    : '';
  return `[${timestamp}] [${level}] [${service}] ${message}${contextStr}`;
}

export function formatAsColoredHuman(entry: LogEntry): string {
  const { timestamp, level, message, service } = entry;
  const contextStr = entry.context
    ? ` ${JSON.stringify(entry.context)}`
    : '';

  const levelColors: Record<LogLevel, string> = {
    ERROR: '\x1b[31m',
    WARN: '\x1b[33m',
    INFO: '\x1b[36m',
    DEBUG: '\x1b[90m',
    TRACE: '\x1b[37m',
  };

  const reset = '\x1b[0m';
  const color = levelColors[level] || '';

  return `${color}[${timestamp}] [${level}] [${service}] ${message}${contextStr}${reset}`;
}

export function formatForLoki(entry: LogEntry): {
  stream: Record<string, string>;
  values: string[];
} {
  const nanoseconds = Date.now() * 1_000_000;

  const stream: Record<string, string> = {
    service: entry.service || 'mimebookmark',
    level: entry.level,
  };

  if (entry.traceId) {
    stream.trace_id = entry.traceId;
  }
  if (entry.spanId) {
    stream.span_id = entry.spanId;
  }
  if (entry.userId) {
    stream.user_id = entry.userId;
  }

  const line = entry.context
    ? `${entry.level} ${entry.message} ${JSON.stringify(entry.context)}`
    : `${entry.level} ${entry.message}`;

  return {
    stream,
    values: [`${nanoseconds}\t${line}`],
  };
}

export function parseLogLevel(levelString: string): LogLevel | null {
  const normalizedLevel = levelString.toUpperCase() as LogLevel;
  if (normalizedLevel in LOG_LEVELS) {
    return normalizedLevel;
  }
  return null;
}

export function getLevelPriority(level: LogLevel): number {
  return LOG_LEVELS[level];
}
