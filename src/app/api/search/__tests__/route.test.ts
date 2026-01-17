import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET as searchGet } from "../route";
import { GET as suggestionsGet } from "../suggestions/route";
import { GET as historyGet, DELETE as historyDelete } from "../history/route";
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

describe("Search API", () => {
  const mockUser = { id: "test-user-id", email: "test@example.com" };
  let mockChain: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);

    mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: "bookmark-1",
            title: "Test Bookmark",
            url: "https://example.com",
            domain: "example.com",
            description: "A test bookmark",
            tags: [],
            collections: [],
          },
        ],
        count: 1,
        error: null,
      }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "search_history") {
        return {
          ...mockChain,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "1",
                query: "test query",
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        };
      }
      return mockChain;
    });
  });

  describe("GET /api/search", () => {
    test("returns search results with highlighting", async () => {
      const request = new NextRequest("http://localhost/api/search?q=test");

      const response = await searchGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("bookmarks");
      expect(data).toHaveProperty("query", "test");
      expect(data).toHaveProperty("pagination");
      expect(Array.isArray(data.bookmarks)).toBe(true);
    });

    test("returns error when query is empty", async () => {
      const request = new NextRequest("http://localhost/api/search?q=");

      const response = await searchGet(request);

      expect(response.status).toBe(400);
    });

    test("returns error when unauthorized", async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
      });

      const request = new NextRequest("http://localhost/api/search?q=test");

      const response = await searchGet(request);

      expect(response.status).toBe(401);
    });

    test("applies filters correctly", async () => {
      const request = new NextRequest(
        "http://localhost/api/search?q=test&is_favorite=true&is_archived=false&sort=newest",
      );

      const response = await searchGet(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("bookmarks");
    });

    test("returns highlighted text", async () => {
      const request = new NextRequest("http://localhost/api/search?q=bookmark");

      const response = await searchGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.bookmarks.length > 0) {
        expect(data.bookmarks[0]).toHaveProperty("titleHighlight");
      }
    });
  });

  describe("GET /api/search/suggestions", () => {
    test("returns suggestions for valid query", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "bookmarks") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({
                          data: [
                            {
                              id: "1",
                              title: "Example",
                              url: "https://example.com",
                              domain: "example.com",
                            },
                          ],
                          count: 1,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return mockChain;
      });

      const request = new NextRequest(
        "http://localhost/api/search/suggestions?q=ex",
      );

      const response = await suggestionsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("suggestions");
      expect(Array.isArray(data.suggestions)).toBe(true);
    });

    test("returns empty array for short query", async () => {
      const request = new NextRequest(
        "http://localhost/api/search/suggestions?q=a",
      );

      const response = await suggestionsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.suggestions).toEqual([]);
    });
  });

  describe("GET /api/search/history", () => {
    test("returns search history", async () => {
      const request = new NextRequest("http://localhost/api/search/history");

      const response = await historyGet(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("history");
    });
  });

  describe("DELETE /api/search/history", () => {
    test("deletes all search history", async () => {
      const request = new NextRequest("http://localhost/api/search/history", {
        method: "DELETE",
      });

      const response = await historyDelete(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("success", true);
    });
  });
});
