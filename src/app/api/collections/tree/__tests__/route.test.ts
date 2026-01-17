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

describe("GET /api/collections/tree", () => {
  const mockUser = { id: "test-user-id" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);
  });

  test("returns tree nodes with parent_id", async () => {
    const mockCollections = [
      {
        id: "root-1",
        name: "Root 1",
        parent_id: null,
        sort_order: 1,
        bookmarks_count: 0,
      },
      {
        id: "child-1",
        name: "Child 1",
        parent_id: "root-1",
        sort_order: 1,
        bookmarks_count: 0,
      },
    ];

    const mockQuery = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockCollections, error: null }),
    };

    vi.mocked(mockSupabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(mockQuery),
    } as any);

    const request = new NextRequest(
      new URL("/api/collections/tree", "http://localhost"),
    );
    const response = await GET(request);
    const data = await response.json();

    expect(data.tree).toBeDefined();
    expect(data.tree.length).toBe(1);
    expect(data.tree[0].id).toBe("root-1");
    expect(data.tree[0].parent_id).toBe(null);
    expect(data.tree[0].children.length).toBe(1);
    expect(data.tree[0].children[0].id).toBe("child-1");
    expect(data.tree[0].children[0].parent_id).toBe("root-1");
  });
});
