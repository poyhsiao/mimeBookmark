import { describe, expect, test, vi, beforeEach } from "vitest";
import { POST } from "../route";
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

describe("POST /api/collections/reorder", () => {
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);
  });

  test("returns 401 when user is not authenticated", async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    });

    const request = new NextRequest(
      new URL("/api/collections/reorder", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ collectionIds: ["id1", "id2"] }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("returns 400 when collectionIds is not an array", async () => {
    const request = new NextRequest(
      new URL("/api/collections/reorder", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ collectionIds: "not-an-array" }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("collectionIds must be a non-empty array");
  });

  test("returns 400 when collectionIds is empty", async () => {
    const request = new NextRequest(
      new URL("/api/collections/reorder", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ collectionIds: [] }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("collectionIds must be a non-empty array");
  });

  test("reorders collections successfully", async () => {
    const mockSelect = {
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [{ id: "id1" }, { id: "id2" }, { id: "id3" }],
        error: null,
      }),
    };
    const mockFrom = {
      select: vi.fn().mockReturnValue(mockSelect),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any);

    const request = new NextRequest(
      new URL("/api/collections/reorder", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ collectionIds: ["id1", "id2", "id3"] }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("collections");
    expect(mockFrom.select).toHaveBeenCalledWith("id");
    expect(mockSelect.in).toHaveBeenCalledWith("id", ["id1", "id2", "id3"]);
    expect(mockSelect.eq).toHaveBeenCalledWith("user_id", "test-user-id");
    expect(mockSelect.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mockFrom.upsert).toHaveBeenCalledWith(
      [
        { id: "id1", sort_order: 0 },
        { id: "id2", sort_order: 1 },
        { id: "id3", sort_order: 2 },
      ],
      { onConflict: "id" },
    );
  });

  test("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest(
      new URL("/api/collections/reorder", "http://localhost"),
      {
        method: "POST",
        body: "invalid json",
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid request body");
  });

  test("returns 500 for server error", async () => {
    vi.mocked(mockSupabase.from).mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const request = new NextRequest(
      new URL("/api/collections/reorder", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ collectionIds: ["id1"] }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  test("returns 400 when collectionIds contains invalid entries", async () => {
    const request = new NextRequest(
      new URL("/api/collections/reorder", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ collectionIds: ["", "  ", 123, null] }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid collectionIds");
  });
});
