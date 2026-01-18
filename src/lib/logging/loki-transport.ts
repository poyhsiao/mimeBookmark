import type { LogEntry, LogTransport, LokiConfig } from '@/types/logging';

export { LokiConfig };

interface LokiBatchEntry {
  stream: Record<string, string>;
  values: string[];
}

interface LokiPushRequest {
  streams: LokiBatchEntry[];
}

export class LokiTransport implements LogTransport {
  name = 'loki';

  private config: {
    url: string;
    username?: string;
    password?: string;
    tenantId?: string;
    batchSize: number;
    flushInterval: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    compressionEnabled: boolean;
  };
  private batch: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  constructor(config: LokiConfig) {
    this.config = {
      url: config.url,
      username: config.username,
      password: config.password,
      tenantId: config.tenantId,
      batchSize: config.batchSize ?? 1000,
      flushInterval: config.flushInterval ?? 5000,
      timeout: config.timeout ?? 10000,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      compressionEnabled: config.compressionEnabled ?? true,
    };
  }

  init(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval);

    if (typeof process !== 'undefined' && (process as NodeJS.Process).on) {
      (process as NodeJS.Process).on('beforeExit', () => {
        this.close().catch(console.error);
      });
    }
  }

  async log(entry: LogEntry): Promise<void> {
    this.batch.push(entry);

    if (this.batch.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const entriesToSend = [...this.batch];
    this.batch = [];

    try {
      await this.sendBatch(entriesToSend);
    } finally {
      this.isFlushing = false;
    }
  }

  private async sendBatch(entriesToSend: LogEntry[]): Promise<void> {
    const lokiEntries = this.buildLokiPayload(entriesToSend);
    const body = JSON.stringify(lokiEntries);

    const headers = this.buildHeaders();

    const lastError = await this.sendWithRetry(body, headers);

    if (lastError) {
      this.batch.unshift(...entriesToSend);
      console.error(`Failed to send logs to Loki: ${lastError.message}`);
    }
  }

  private buildLokiPayload(entries: LogEntry[]): LokiPushRequest {
    const streamLabels: Record<string, string> = {
      service: 'mimebookmark',
      environment: process.env.NODE_ENV || 'development',
    };

    if (this.config.tenantId) {
      streamLabels.tenant = this.config.tenantId;
    }

    const stream: Record<string, string> = {};
    for (const [key, value] of Object.entries(streamLabels)) {
      if (value) stream[key] = value;
    }

    const values = entries.map((entry) => {
      const nanoseconds = Date.now() * 1_000_000;
      const line = this.formatLogLine(entry);
      return `${nanoseconds}\t${line}`;
    });

    return {
      streams: [
        {
          stream,
          values,
        },
      ],
    };
  }

  private formatLogLine(entry: LogEntry): string {
    const base = `${entry.level} ${entry.message}`;
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context);
      return `${base} ${contextStr}`;
    }
    return base;
  }

  private buildHeaders(): Headers {
    const headers = new Headers();

    headers.set('Content-Type', 'application/json');

    if (this.config.tenantId) {
      headers.set('X-Scope-OrgID', this.config.tenantId);
    }

    if (this.config.username && this.config.password) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString('base64');
      headers.set('Authorization', `Basic ${credentials}`);
    }

    return headers;
  }

  private async sendWithRetry(
    body: string,
    headers: Headers
  ): Promise<Error | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Loki API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return null;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retryAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay * attempt)
          );
        }
      }
    }

    return lastError;
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }
}

export function createLokiTransport(config: LokiConfig): LokiTransport {
  const transport = new LokiTransport(config);
  transport.init();
  return transport;
}
