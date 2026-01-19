import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("GET /api/me/settings - TDD", () => {
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);
  });

  test("GREEN: returns 500 when profile creation fails", async () => {
    const fromSpy = vi.mocked(mockSupabase.from);

    // First call (select): returns nothing
    const selectSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "0 rows" } });

    // Second call (insert with ignoreDuplicates): fails
    const insertSelectMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

    fromSpy.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: selectSingle,
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            maybeSingle: insertSelectMaybeSingle,
          }),
        } as any;
      }
      return {} as any;
    });

    const request = new NextRequest(
      new URL("/api/me/settings", "http://localhost"),
    );
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Profile not found and could not be created");
  });

  test("GREEN: handles race condition using insert with ignoreDuplicates", async () => {
    const fromSpy = vi.mocked(mockSupabase.from);

    // Initial select: returns nothing (0 rows)
    const initialSelect = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "0 rows" } });

    // Insert with ignoreDuplicates: succeeds
    const insertSucceed = vi.fn().mockResolvedValueOnce({
      data: { id: mockUser.id, display_name: "Test User", preferences: {} },
      error: null,
    });

    fromSpy.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: initialSelect,
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            maybeSingle: insertSucceed,
          }),
        } as any;
      }
      return {} as any;
    });

    const request = new NextRequest(
      new URL("/api/me/settings", "http://localhost"),
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings.displayName).toBe("Test User");
  });

  test("GREEN: handles fallback fetch when insert is ignored due to race condition", async () => {
    const fromSpy = vi.mocked(mockSupabase.from);

    // Initial select: returns nothing (0 rows)
    const initialSelect = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "0 rows" } });

    // Insert with ignoreDuplicates: returns null (insert was ignored)
    const insertIgnored = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    });

    // Fallback select: successfully fetches existing profile
    const fallbackSelect = vi.fn().mockResolvedValueOnce({
      data: { id: mockUser.id, display_name: "Existing User", preferences: {} },
      error: null,
    });

    let selectCallCount = 0;
    fromSpy.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: () => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return initialSelect();
            } else {
              return fallbackSelect();
            }
          },
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            maybeSingle: insertIgnored,
          }),
        } as any;
      }
      return {} as any;
    });

    const request = new NextRequest(
      new URL("/api/me/settings", "http://localhost"),
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings.displayName).toBe("Existing User");
    expect(selectCallCount).toBe(2); // Verify fallback select was called
  });
});
