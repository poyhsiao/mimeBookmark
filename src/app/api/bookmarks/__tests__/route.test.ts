import { describe, expect, test, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
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

describe('GET /api/bookmarks', () => {
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

    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'));
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  test('returns bookmarks with default pagination', async () => {
    const mockBookmarks = [
      { id: '1', url: 'https://example.com', title: 'Example', user_id: 'test-user-id' },
      { id: '2', url: 'https://test.com', title: 'Test', user_id: 'test-user-id' },
    ];

    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: mockBookmarks,
                error: null,
                count: 2,
              } as any),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'));
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bookmarks).toHaveLength(2);
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(20);
    expect(data.pagination.total).toBe(2);
  });

  test('handles pagination parameters', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 50,
              } as any),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/bookmarks?page=2&limit=10', 'http://localhost')
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.totalPages).toBe(5);
  });

  test('filters by collection_id', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0,
              } as any),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/bookmarks?collection_id=col-123', 'http://localhost')
    );
    const response = await GET(request);

    // Should return 200 with empty results for filtered query
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bookmarks).toEqual([]);
  });

  test('filters favorites', async () => {
    let capturedEqArgs: unknown[] = [];
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(function(this: unknown, ...args: unknown[]) {
              capturedEqArgs.push(args);
              return this;
            }),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0,
              } as any),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/bookmarks?is_favorite=true', 'http://localhost')
    );
    await GET(request);

    // Should have eq calls for user_id, is_favorite, and is_archived
    expect(capturedEqArgs.length).toBeGreaterThanOrEqual(2);
  });

  test('sorts by oldest first', async () => {
    let capturedOrderArgs: unknown;
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockImplementation(function(this: unknown, ...args: unknown[]) {
              capturedOrderArgs = args;
              return {
                range: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                  count: 0,
                } as any),
              };
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      new URL('/api/bookmarks?sort=oldest', 'http://localhost')
    );
    await GET(request);

    expect(capturedOrderArgs).toEqual(['created_at', { ascending: true }]);
  });

  test('returns 500 on database error', async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
                count: null,
              } as any),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'));
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Database error');
  });
});

describe('POST /api/bookmarks', () => {
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

    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  test('returns 400 when URL is missing', async () => {
    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({ title: 'No URL' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('URL is required');
  });

  test('creates bookmark with valid data', async () => {
    const mockBookmark = {
      id: 'new-bookmark-id',
      url: 'https://example.com',
      title: 'Example Site',
      user_id: 'test-user-id',
      domain: 'example.com',
    };

    let capturedInsertData: unknown;
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          insert: vi.fn().mockImplementation(function(this: unknown, data: unknown) {
            capturedInsertData = data;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockBookmark,
                  error: null,
                } as any),
              }),
            };
          }),
        };
      }
      if (table === 'bookmark_tags') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {};
    });

    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://example.com',
        title: 'Example Site',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.bookmark.id).toBe('new-bookmark-id');
    expect(data.bookmark.url).toBe('https://example.com');
  });

  test('extracts domain from URL', async () => {
    let capturedDomain: string | null = null;

    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          insert: vi.fn().mockImplementation(function(this: unknown, data: any) {
            capturedDomain = data.domain;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...data, id: 'test-id' },
                  error: null,
                } as any),
              }),
            };
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://www.example.com/page?q=test',
        title: 'Test',
      }),
    });
    await POST(request);

    expect(capturedDomain).toBe('www.example.com');
  });

  test('handles invalid JSON body', async () => {
    const request = new NextRequest(new URL('/api/bookmarks', 'http://localhost'), {
      method: 'POST',
      body: 'not valid json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
