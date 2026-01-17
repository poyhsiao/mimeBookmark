import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
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

describe("GET /api/tags", () => {
  const mockUser = { id: "test-user-id" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);
  });

  test("returns 401 for unauthenticated user", async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    } as any);

    const request = new NextRequest(
      new URL("/api/tags", "http://localhost"),
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  test("returns tags for authenticated user", async () => {
    const mockTags = [
      { id: "tag-1", name: "react", color: "#6366F1", usage_count: 5 },
      { id: "tag-2", name: "typescript", color: "#3178C6", usage_count: 3 },
    ];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockTags, count: 2, error: null }),
    };

    mockSupabase.from.mockReturnValue(mockQuery as any);

    const request = new NextRequest(
      new URL("/api/tags", "http://localhost"),
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tags).toEqual(mockTags);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
  });

  test("supports search parameter", async () => {
    let ilikeCalled = false;

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockImplementation(function(this: any) {
        ilikeCalled = true;
        return this;
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      then(resolve: any) {
        resolve({ data: [], count: 0, error: null });
      },
    };

    mockSupabase.from.mockReturnValue(mockQuery as any);

    const request = new NextRequest(
      new URL("/api/tags?search=react", "http://localhost"),
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(ilikeCalled).toBe(true);
  });
});

describe("POST /api/tags", () => {
  const mockUser = { id: "test-user-id" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);
  });

  test("returns 401 for unauthenticated user", async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    } as any);

    const request = new NextRequest(
      new URL("/api/tags", "http://localhost"),
      { method: "POST", body: JSON.stringify({ name: "test-tag" }) },
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  test("creates a new tag", async () => {
    const mockTag = { id: "tag-1", name: "test-tag", color: "#6366F1", usage_count: 0 };

    // Create a mock chain that properly supports method chaining
    const createMockQuery = () => {
      const mockObj: Record<string, any> = {};
      
      const methods = ['select', 'eq', 'ilike', 'is', 'single', 'insert'];
      methods.forEach(method => {
        mockObj[method] = vi.fn().mockImplementation(function(this: any) {
          if (method === 'single') {
            return Promise.resolve({ data: null, error: { code: "PGRST116" } });
          }
          if (method === 'insert') {
            return {
              select: vi.fn().mockImplementation(() => ({
                single: vi.fn().mockResolvedValue({ data: mockTag, error: null })
              }))
            };
          }
          return this;
        });
      });
      
      return mockObj;
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tags") {
        return createMockQuery();
      }
      return { select: vi.fn() };
    });

    const request = new NextRequest(
      new URL("/api/tags", "http://localhost"),
      { method: "POST", body: JSON.stringify({ name: "test-tag", color: "#6366F1" }) },
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.tag).toBeDefined();
    expect(data.tag.name).toBe("test-tag");
  });

  test("returns 400 for empty tag name", async () => {
    const request = new NextRequest(
      new URL("/api/tags", "http://localhost"),
      { method: "POST", body: JSON.stringify({ name: "", color: "#6366F1" }) },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Tag name is required");
  });
});
