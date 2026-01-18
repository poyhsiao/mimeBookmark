export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  service?: string;
  context?: Record<string, unknown>;
}

export interface LogTransport {
  name: string;
  log(entry: LogEntry): Promise<void> | void;
}

export class ConsoleTransport implements LogTransport {
  public name = "console";

  private format(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const service = entry.service ? `[${entry.service}]` : "";
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    return `${timestamp} ${level} ${service} ${entry.message}${context}`;
  }

  constructor() {}

  public log(entry: LogEntry): void {
    const formatted = this.format(entry);

    switch (entry.level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }
}
