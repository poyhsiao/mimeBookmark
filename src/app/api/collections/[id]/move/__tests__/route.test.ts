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

describe("POST /api/collections/[id]/move", () => {
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
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: null }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("returns 400 when collection ID is missing", async () => {
    const request = new NextRequest(
      new URL("/api/collections//move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: null }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Collection ID is required");
  });

  test("returns 400 when parent_id is invalid", async () => {
    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: 123 }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("parent_id must be a string or null");
  });

  test("returns 400 when collection is its own parent", async () => {
    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: "col-1" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("A collection cannot be a parent of itself");
  });

  test("returns 400 when parent_id is empty string", async () => {
    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: "  " }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("parent_id must be a non-empty string or null");
  });

  test("returns 404 when collection not found", async () => {
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "Not found" } }),
    };
    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any);

    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: null }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Collection not found");
  });

  test("returns 403 when user does not own collection", async () => {
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "col-1", user_id: "other-user" },
        error: null,
      }),
    };
    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any);

    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: null }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("moves collection successfully", async () => {
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({
          data: { id: "col-1", user_id: "test-user-id" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "parent-col", user_id: "test-user-id" },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null }), // for ancestor check
      update: vi.fn().mockReturnThis(),
    };
    mockFrom.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    } as any);
    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any);

    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: "parent-col" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("moves collection to root", async () => {
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "col-1", user_id: "test-user-id" },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    };
    mockFrom.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    } as any);
    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any);

    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: null }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("returns 404 when parent collection not found", async () => {
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({
          data: { id: "col-1", user_id: "test-user-id" },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: { message: "Not found" } }),
    };
    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any);

    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: "parent-col" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Parent collection not found");
  });

  test("returns 404 when parent is not owned by user", async () => {
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({
          data: { id: "col-1", user_id: "test-user-id" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "parent-col", user_id: "other-user" },
          error: null,
        }),
    };
    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any);

    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: JSON.stringify({ parent_id: "parent-col" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Parent collection not found");
  });

  test("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest(
      new URL("/api/collections/col-1/move", "http://localhost"),
      {
        method: "POST",
        body: "invalid json",
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "col-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid request body");
  });
});
