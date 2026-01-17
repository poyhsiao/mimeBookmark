'use server';

import type { LogLevel } from '@/types/logging';
import { Logger, createLogger } from './logger';
import { LokiTransport, createLokiTransport } from './loki-transport';
import { ConsoleTransport, createConsoleTransport } from './log-transport';

let serverLogger: Logger | null = null;

function getLokiConfig(): {
  url: string;
  username?: string;
  password?: string;
  tenantId?: string;
} {
  return {
    url: process.env.LOKI_URL || 'http://localhost:3100',
    username: process.env.LOKI_USERNAME,
    password: process.env.LOKI_PASSWORD,
    tenantId: process.env.LOKI_TENANT_ID,
  };
}

function createServerLogger(): Logger {
  const level = (process.env.LOG_LEVEL as LogLevel) || 'INFO';
  const transports = [];

  const consoleTransport = createConsoleTransport(
    process.env.NODE_ENV === 'production' ? 'json' : 'human'
  );
  transports.push(consoleTransport);

  const lokiConfig = getLokiConfig();
  if (lokiConfig.url && lokiConfig.url !== 'http://localhost:3100') {
    const lokiTransport = createLokiTransport(lokiConfig);
    transports.push(lokiTransport);
  }

  const logger = createLogger({
    level,
    service: 'mimebookmark-server',
    transports,
  });

  return logger;
}

export async function getServerLogger(): Promise<Logger> {
  if (!serverLogger) {
    serverLogger = createServerLogger();
  }
  return serverLogger;
}

export async function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
): Promise<void> {
  const logger = await getServerLogger();

  const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

  await logger.log(level, `${method} ${path} ${statusCode}`, {
    method,
    path,
    statusCode,
    duration,
    userId,
  });
}

export async function logError(
  error: Error | unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const logger = await getServerLogger();
  await logger.error(String(error), context);
}

export async function logInfo(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  const logger = await getServerLogger();
  await logger.info(message, context);
}

export async function logDebug(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  const logger = await getServerLogger();
  await logger.debug(message, context);
}

export async function flushLogs(): Promise<void> {
  if (serverLogger) {
    await serverLogger.flush();
  }
}

export async function closeLogs(): Promise<void> {
  if (serverLogger) {
    await serverLogger.close();
    serverLogger = null;
  }
}