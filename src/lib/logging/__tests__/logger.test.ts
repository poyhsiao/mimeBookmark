import { describe, it, expect, beforeEach, vi } from "vitest";
import { getServerLogger, resetServerLogger, Logger } from "../logger";

describe("Logger", () => {
  beforeEach(() => {
    resetServerLogger();
  });

  describe("Singleton", () => {
    it("provides a singleton instance", () => {
      const logger1 = getServerLogger();
      const logger2 = getServerLogger();
      expect(logger1).toBe(logger2);
    });

    it("allows resetting the logger", () => {
      const logger1 = getServerLogger();
      resetServerLogger();
      const logger2 = getServerLogger();
      expect(logger1).not.toBe(logger2);
    });

    it("throws if re-initialized with new options", () => {
      getServerLogger({ service: "first" });
      expect(() => getServerLogger({ service: "second" })).toThrow(
        /already exists/,
      );
    });
  });

  describe("createChild", () => {
    it("creates a child logger with merged context", async () => {
      const mockLog = vi.fn();
      const transport = { name: "mock", log: mockLog };
      const logger = new Logger({ transports: [transport] });

      const child = logger.createChild({ request_id: "123" });
      await child.info("test message", { user: "bob" });

      expect(mockLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "test message",
          context: { request_id: "123", user: "bob" },
        }),
      );
    });

    it("supports nested child loggers", async () => {
      const mockLog = vi.fn();
      const transport = { name: "mock", log: mockLog };
      const logger = new Logger({ transports: [transport] });

      const child1 = logger.createChild({ level1: "a" });
      const child2 = child1.createChild({ level2: "b" });

      await child2.info("deep message", { current: "c" });

      expect(mockLog).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { level1: "a", level2: "b", current: "c" },
        }),
      );
    });
  });
});
