import type { LogLevel } from '@/types/logging';
import { Logger, createLogger } from './logger';
import { ConsoleTransport, createConsoleTransport } from './log-transport';

let clientLogger: Logger | null = null;

function getClientLogger(): Logger {
  if (clientLogger) return clientLogger;

  const level = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'INFO';

  const consoleTransport = createConsoleTransport(
    process.env.NODE_ENV === 'production' ? 'json' : 'human'
  );

  clientLogger = createLogger({
    level,
    service: 'mimebookmark-client',
    transports: [consoleTransport],
  });

  return clientLogger;
}

export function logClientInfo(
  message: string,
  context?: Record<string, unknown>
): void {
  const logger = getClientLogger();
  logger.info(message, context).catch(console.error);
}

export function logClientError(
  message: string,
  context?: Record<string, unknown>
): void {
  const logger = getClientLogger();
  logger.error(message, context).catch(console.error);
}

export function logClientDebug(
  message: string,
  context?: Record<string, unknown>
): void {
  const logger = getClientLogger();
  logger.debug(message, context).catch(console.error);
}

export function logClientTrace(
  message: string,
  context?: Record<string, unknown>
): void {
  const logger = getClientLogger();
  logger.trace(message, context).catch(console.error);
}

export function setClientLogLevel(level: LogLevel): void {
  const logger = getClientLogger();
  logger.setLevel(level);
}

export function getClientLogLevel(): LogLevel {
  const logger = getClientLogger();
  return logger.getLevel();
}
