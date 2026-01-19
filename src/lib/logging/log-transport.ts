import type { LogEntry, LogTransport } from '@/types/logging';

export { LogTransport };

export class ConsoleTransport implements LogTransport {
  name = 'console';

  private format: 'json' | 'human';
  private colors: boolean;

  constructor(format: 'json' | 'human' = 'human', colors = true) {
    this.format = format;
    this.colors = colors && process.stdout.isTTY;
  }

  log(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    this.writeToConsole(entry.level, formatted);
  }

  private formatEntry(entry: LogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }

    const { timestamp, level, message, service } = entry;
    const contextStr = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : '';

    const levelColors: Record<string, string> = {
      ERROR: '\x1b[31m',
      WARN: '\x1b[33m',
      INFO: '\x1b[36m',
      DEBUG: '\x1b[90m',
      TRACE: '\x1b[37m',
    };

    const reset = '\x1b[0m';
    const color = this.colors ? levelColors[entry.level] || '' : '';

    return `${color}[${timestamp}] [${level}] [${service}] ${message}${contextStr}${reset}`;
  }

  private writeToConsole(level: string, message: string): void {
    if (level === 'ERROR') {
      console.error(message);
    } else if (level === 'WARN') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }
}

export class NoopTransport implements LogTransport {
  name = 'noop';

  log(_entry: LogEntry): void {
    // No-op transport - discards all logs
  }
}

export function createConsoleTransport(
  format: 'json' | 'human' = 'human'
): ConsoleTransport {
  return new ConsoleTransport(format);
}

export function createNoopTransport(): NoopTransport {
  return new NoopTransport();
}
