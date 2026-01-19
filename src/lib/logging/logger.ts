import type { LogEntry, LogLevel, LoggerOptions, LogTransport } from '@/types/logging';
import { isLevelEnabled, LOG_LEVELS } from '@/types/logging';

class Logger {
  private options: LoggerOptions;
  private initialized = false;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: options.level || 'INFO',
      service: options.service || 'mimebookmark',
      transports: options.transports || [],
      environment: options.environment || process.env.NODE_ENV || 'development',
      version: options.version || process.env.npm_package_version || '1.0.0',
    };
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
  }

  private shouldLog(level: LogLevel): boolean {
    return isLevelEnabled(this.options.level, level);
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.options.service,
      context: {
        ...context,
        environment: this.options.environment,
        version: this.options.version,
      },
    };

    return entry;
  }

  private async writeToTransports(entry: LogEntry): Promise<void> {
    const writePromises = this.options.transports.map((transport) => {
      try {
        const result = transport.log(entry);
        return result instanceof Promise ? result : Promise.resolve();
      } catch (error) {
        console.error(`Log transport "${transport.name}" failed:`, error);
        return Promise.resolve();
      }
    });

    await Promise.all(writePromises);
  }

  async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, context);

    if (this.options.transports.length > 0) {
      await this.writeToTransports(entry);
    }

    const formattedEntry = this.formatForConsole(entry);
    this.writeToConsole(level, formattedEntry);
  }

  private formatForConsole(entry: LogEntry): string {
    const { timestamp, level, message, service } = entry;
    const contextStr = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : '';
    return `[${timestamp}] [${level}] [${service}] ${message}${contextStr}`;
  }

  private writeToConsole(level: LogLevel, formattedMessage: string): void {
    switch (level) {
      case 'ERROR':
        console.error(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'INFO':
      case 'DEBUG':
      case 'TRACE':
        console.log(formattedMessage);
        break;
    }
  }

  error(message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('ERROR', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('WARN', message, context);
  }

  info(message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('INFO', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('DEBUG', message, context);
  }

  trace(message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('TRACE', message, context);
  }

  async flush(): Promise<void> {
    const flushPromises = this.options.transports
      .filter((transport) => typeof transport.flush === 'function')
      .map(async (transport) => {
        try {
          await transport.flush?.();
        } catch (error) {
          console.error(
            `Log transport "${transport.name}" flush failed:`,
            error
          );
        }
      });

    await Promise.all(flushPromises);
  }

  async close(): Promise<void> {
    const closePromises = this.options.transports
      .filter((transport) => typeof transport.close === 'function')
      .map(async (transport) => {
        try {
          await transport.close?.();
        } catch (error) {
          console.error(
            `Log transport "${transport.name}" close failed:`,
            error
          );
        }
      });

    await Promise.all(closePromises);
  }

  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  addTransport(transport: LogTransport): void {
    this.options.transports.push(transport);
  }

  removeTransport(name: string): void {
    this.options.transports = this.options.transports.filter(
      (t) => t.name !== name
    );
  }

  getLevel(): LogLevel {
    return this.options.level;
  }

  getService(): string {
    return this.options.service;
  }
}

let globalLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
    globalLogger.init();
  }
  return globalLogger;
}

export function createLogger(options: Partial<LoggerOptions>): Logger {
  const logger = new Logger(options);
  logger.init();
  return logger;
}

export { Logger };
export default Logger;
