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
      return new Promise((_resolve, reject) => {
        if (signal?.aborted) {
          // Reject with AbortError when already aborted
          const abortError = new DOMException('The operation was aborted', 'AbortError');
          reject(abortError);
          return;
        }
        signal?.addEventListener("abort", () => {
          // Reject with AbortError when abort event fires
          const abortError = new DOMException('The operation was aborted', 'AbortError');
          reject(abortError);
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

    // Transport should swallow errors, so promise should resolve without error
    await expect(promise).resolves.toBeUndefined();
  }, 10000);
});
