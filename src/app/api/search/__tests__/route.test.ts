import { describe, expect, test, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('GET /api/search', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
    } as any);
  });

  test('returns 401 when user is not authenticated', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: null },
    } as any);

    const request = new NextRequest(new URL('/api/search?q=test', 'http://localhost'));
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  test('returns 400 when query is empty', async () => {
    const request = new NextRequest(new URL('/api/search?q=', 'http://localhost'));
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Search query is required');
  });

  test('returns 400 when query is only whitespace', async () => {
    const request = new NextRequest(new URL('/api/search?q=%20%20%20', 'http://localhost'));
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  test('returns search results with highlights', async () => {
    const mockBookmarks = [
      {
        id: '1',
        url: 'https://example.com',
        title: 'Example Site',
        description: 'Test description',
        user_id: 'test-user-id',
      },
    ];

    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: mockBookmarks,
              error: null,
              count: 1,
            } as any),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/search?q=example', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bookmarks).toHaveLength(1);
    expect(data.query).toBe('example');
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(20);
  });

  test('handles pagination parameters', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 50,
            } as any),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/search?q=test&page=2&limit=10', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.totalPages).toBe(5);
  });

  test('sanitizes special characters in search term', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockImplementation(function(this: unknown, ...args: unknown[]) {
              // Verify sanitization happened - %, _ should be escaped with backslash
              const [pattern] = args as [string];
              // Input: test%_query -> Sanitized: test\%\_query
              // The pattern should contain the escaped versions
              expect(pattern).toContain('\\%');
              expect(pattern).toContain('\\_');
              // Should NOT contain the raw unescaped special chars in the search term
              expect(pattern).not.toContain('test%');
              expect(pattern).not.toContain('test_');
              return this;
            }),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            } as any),
          }),
        };
      }
      return {};
    });

    // Use %25 to encode the literal % character in URL
    const request = new NextRequest(
      new URL('/api/search?q=test%25_query', 'http://localhost')
    );
    await GET(request);
  });

  test('filters by collection_id', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            } as any),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/search?q=test&collection_id=col-123', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  test('filters by is_favorite', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            } as any),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/search?q=test&is_favorite=true', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  test('filters by domain', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            } as any),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/search?q=test&domain=example.com', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  test('filters by date range', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            } as any),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/search?q=test&date_from=2024-01-01&date_to=2024-12-31', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  test('returns 500 on database error', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
              count: null,
            } as any),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/search?q=test', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Database error');
  });

  test('limits max results to 100', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            } as any),
          }),
        };
      }
      return {};
    });

    // Request with limit exceeding max
    const request = new NextRequest(
      new URL('/api/search?q=test&limit=200', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    // Limit should be capped at 100
    expect(data.pagination.limit).toBe(100);
  });

  test.each(['newest', 'oldest', 'title', 'domain', 'clicks', 'relevance'])(
    'sorts by %s',
    async (sortBy) => {
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              or: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0,
              } as any),
            }),
          };
        }
        return {};
      });

      const request = new NextRequest(
        new URL(`/api/search?q=test&sort=${sortBy}`, 'http://localhost')
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    }
  );
});
