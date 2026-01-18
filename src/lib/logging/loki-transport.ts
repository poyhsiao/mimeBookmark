import { LogEntry, LogTransport } from "./log-transport";

export interface LokiBatchEntry {
  stream: Record<string, string>;
  values: Array<[string, string]>; // [timestampNsString, line]
}

export interface LokiPushRequest {
  streams: LokiBatchEntry[];
}

export class LokiTransport implements LogTransport {
  public name = "loki";

  private lokiUrl: string;
  private service: string;

  constructor(
    options: { lokiUrl: string; service?: string } = { lokiUrl: "" },
  ) {
    this.lokiUrl =
      options.lokiUrl || process.env.LOKI_URL || "http://localhost:3100";
    this.service = options.service || "mimebookmark";
  }

  private formatLogLine(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase();
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    return `${timestamp} ${level} [${this.service}] ${entry.message}${context}`;
  }

  private buildLokiPayload(entries: LogEntry[]): LokiPushRequest {
    const streams: LokiBatchEntry[] = [];

    for (const entry of entries) {
      const timestampNs =
        (entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now()) *
        1_000_000;
      const line = this.formatLogLine(entry);

      // Define labels object for consistent matching
      const labels = {
        service: this.service,
        level: entry.level,
        job: "mimebookmark",
      };

      // Check if we already have a stream with these exact labels
      let streamEntry = streams.find(
        (s) => JSON.stringify(s.stream) === JSON.stringify(labels),
      );

      if (!streamEntry) {
        streamEntry = {
          stream: { ...labels },
          values: [],
        };
        streams.push(streamEntry);
      }

      // Add the log line with nanosecond timestamp
      streamEntry.values.push([String(timestampNs), line]);
    }

    return { streams };
  }

  private async sendBatch(entries: LogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const payload = this.buildLokiPayload(entries);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.lokiUrl}/loki/api/v1/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Loki push failed: ${response.status} ${errorText}`);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error("Loki push timed out after 5s");
      } else {
        console.error("Failed to send logs to Loki:", error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async log(entry: LogEntry): Promise<void> {
    await this.sendBatch([entry]);
  }

  // Batch log multiple entries for better performance
  public async logBatch(entries: LogEntry[]): Promise<void> {
    await this.sendBatch(entries);
  }
}
