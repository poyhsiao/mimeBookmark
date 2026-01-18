import { describe, it, expect, vi, beforeEach } from "vitest";
import { logError } from "../server";
import { getServerLogger, resetServerLogger } from "../logger";

describe("Server Logging", () => {
  beforeEach(() => {
    resetServerLogger();
  });

  it("passes the actual error object to the logger", async () => {
    const logger = getServerLogger();
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(async () => {});

    const testError = new Error("Original error");
    await logError(testError, { message: "Wrapped message" });

    expect(errorSpy).toHaveBeenCalledWith(
      "Wrapped message",
      testError,
      expect.any(Object),
    );
  });
});
