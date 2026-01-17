import { describe, expect, test, vi, beforeEach } from "vitest";
import { setUser } from "@/lib/monitoring/set-user";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({
  setUser: vi.fn(),
}));

describe("set-user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setUser", () => {
    test("sets user context with valid user data", () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        username: "testuser",
      };
      setUser(user);
      expect(Sentry.setUser).toHaveBeenCalledWith(user);
    });

    test("sets user context with minimal data", () => {
      const user = { id: "user-456" };
      setUser(user);
      expect(Sentry.setUser).toHaveBeenCalledWith(user);
    });

    test("clears user context when null is passed", () => {
      setUser(null);
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    test("handles user with extra properties", () => {
      const user = {
        id: "user-789",
        email: "admin@example.com",
        role: "admin",
      };
      setUser(user);
      // 目前實作只會轉發 id, email, username，
      // 根據需求更新後，應該會轉發所有屬性。
      // 這個測試目前在 RED 階段預期會失敗（如果斷言包含 role）。
      expect(Sentry.setUser).toHaveBeenCalledWith(user);
    });
  });
});
