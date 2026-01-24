import { describe, it, expect, vi, beforeEach } from "vitest";
import { logError, getServerLogger } from "../server";

describe("Server Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the actual error object to the logger", async () => {
    const logger = await getServerLogger();
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(async () => {});

    const testError = new Error("Original error");
    await logError(testError, { message: "Wrapped message" });

    expect(errorSpy).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({ message: "Wrapped message" }),
    );
  });
});
