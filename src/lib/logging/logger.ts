import { LogEntry, LogTransport, ConsoleTransport } from "./log-transport";
import { LokiTransport } from "./loki-transport";

export interface LoggerOptions {
  service?: string;
  transports?: LogTransport[];
  lokiUrl?: string;
  environment?: "development" | "production" | "test";
}

export class Logger {
  protected service: string;
  protected transports: LogTransport[];
  protected environment: string;
  protected context: Record<string, unknown>;

  constructor(
    options: LoggerOptions & {
      _internalContext?: Record<string, unknown>;
    } = {},
  ) {
    this.service = options.service || "mimebookmark";
    this.environment = this.validateNodeEnv(
      options.environment || process.env.NODE_ENV,
    );
    this.context = options._internalContext || {};
    this.transports = options.transports ? [...options.transports] : [];

    if (!this.transports.find((t) => t.name === "console")) {
      this.transports.push(new ConsoleTransport());
    }

    const lokiUrl = options.lokiUrl || process.env.LOKI_URL;
    if (lokiUrl && !this.transports.find((t) => t.name === "loki")) {
      this.transports.push(
        new LokiTransport({ lokiUrl, service: this.service }),
      );
    }
  }

  /**
   * Validates the node environment and returns a safe default if invalid.
   */
  private validateNodeEnv(
    env: string | undefined,
  ): "development" | "production" | "test" {
    const validEnvs = ["development", "production", "test"] as const;
    if (env && (validEnvs as readonly string[]).includes(env)) {
      return env as "development" | "production" | "test";
    }
    return "development";
  }

  private createEntry(
    level: LogEntry["level"],
    message: string,
    context?: Record<string, unknown>,
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      context: { ...this.context, ...context },
    };
  }

  private async writeToTransports(entry: LogEntry): Promise<void> {
    const transportPromises = this.transports.map(async (transport) => {
      try {
        const result = transport.log(entry);
        if (result instanceof Promise) {
          await Promise.resolve(result).catch((err) => {
            console.error(`Log transport "${transport.name}" failed:`, err);
          });
        }
      } catch (err) {
        console.error(`Log transport "${transport.name}" failed:`, err);
      }
    });

    await Promise.all(transportPromises);
  }

  public async debug(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry = this.createEntry("debug", message, context);
    await this.writeToTransports(entry);
  }

  public async info(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry = this.createEntry("info", message, context);
    await this.writeToTransports(entry);
  }

  public async warn(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry = this.createEntry("warn", message, context);
    await this.writeToTransports(entry);
  }

  public async error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const errorContext = error
      ? {
          ...(context || {}),
          errorMessage: error.message,
          errorStack: error.stack,
        }
      : context || {};

    const entry = this.createEntry("error", message, errorContext);
    await this.writeToTransports(entry);
  }

  public addTransport(transport: LogTransport): void {
    if (!this.transports.find((t) => t.name === transport.name)) {
      this.transports.push(transport);
    }
  }

  public removeTransport(name: string): void {
    this.transports = this.transports.filter((t) => t.name !== name);
  }

  public createChild(context: Record<string, unknown>): Logger {
    return new Logger({
      service: this.service,
      transports: [...this.transports],
      environment: this.environment as any,
      _internalContext: { ...this.context, ...context },
    });
  }
}

// Singleton instance for server-side logging
let serverLogger: Logger | null = null;

export function resetServerLogger(): void {
  serverLogger = null;
}

export function getServerLogger(options?: LoggerOptions): Logger {
  if (serverLogger && options) {
    throw new Error(
      "Server logger already exists. Use resetServerLogger() to re-initialize with new options.",
    );
  }
  if (!serverLogger) {
    serverLogger = new Logger({
      service: "mimebookmark-server",
      ...options,
    });
  }
  return serverLogger;
}
