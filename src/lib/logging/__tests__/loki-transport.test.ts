import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LokiTransport } from "../loki-transport";

describe("LokiTransport", () => {
  const lokiUrl = "http://loki:3100";
  let transport: LokiTransport;

  beforeEach(() => {
    transport = new LokiTransport({ lokiUrl });
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts fetch if it exceeds timeout", async () => {
    vi.mocked(fetch).mockImplementation((_url, options: any) => {
      const signal = options?.signal;
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Aborted"));
        }
        signal?.addEventListener("abort", () => {
          reject(new Error("Aborted"));
        });
      });
    });

    const promise = transport.log({
      level: "info",
      message: "test timeout",
      timestamp: new Date().toISOString(),
    });

    // Advance time and resolve pending promises
    await vi.advanceTimersByTimeAsync(10000);

    await expect(promise).rejects.toThrow();
  }, 10000);
});
