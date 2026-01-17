import { describe, expect, test, vi, beforeEach } from "vitest";
import { PUT } from "../route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("PUT /api/me/settings", () => {
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);
  });

  test("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest(
      new URL("/api/me/settings", "http://localhost"),
      {
        method: "PUT",
        body: "invalid json",
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON payload");
  });

  test("returns 500 for server error", async () => {
    vi.mocked(mockSupabase.rpc).mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const request = new NextRequest(
      new URL("/api/me/settings", "http://localhost"),
      {
        method: "PUT",
        body: JSON.stringify({ theme: "dark" }),
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to update settings");
  });

  test("returns 500 when RPC returns error object", async () => {
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "Database function failed" },
    } as any);

    const request = new NextRequest(
      new URL("/api/me/settings", "http://localhost"),
      {
        method: "PUT",
        body: JSON.stringify({ theme: "dark" }),
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Database function failed");
  });

  test("returns 400 for null body", async () => {
    const request = new NextRequest(
      new URL("/api/me/settings", "http://localhost"),
      {
        method: "PUT",
        body: "null",
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });
});
