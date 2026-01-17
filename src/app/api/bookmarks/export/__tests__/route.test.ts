
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';

// Mock dependencies
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: vi.fn(),
}));

describe('Export Route', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth mock
    vi.mocked(getCurrentUser).mockResolvedValue({ user: mockUser } as any);

    // Default supabase chain mocks
    const mockSelect = vi.fn();
    const mockEq = vi.fn();
    const mockIs = vi.fn();
    const mockOrder = vi.fn();

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      is: mockIs,
    });

    mockIs.mockReturnValue({
      order: mockOrder,
    });

    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  test('should fail if collections fetch errors but bookmarks does not', async () => {
    // Setup bookmarks success
    const mockBookmarksOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null
    });

    // Setup collections error
    const mockCollectionsOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Collections error' }
    });

    // We need to differentiate the calls to .from()
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: () => ({ eq: () => ({ is: () => ({ order: mockBookmarksOrder }) }) })
        };
      }
      if (table === 'collections') {
        return {
          select: () => ({ eq: () => ({ is: () => ({ order: mockCollectionsOrder }) }) })
        };
      }
      if (table === 'tags') {
         return {
          select: () => ({ eq: () => ({ is: () => ({ order: vi.fn().mockResolvedValue({ data: [] }) }) }) })
        };
      }
      return { select: vi.fn() };
    });

    const req = new NextRequest('http://localhost/api/bookmarks/export?format=json');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'Failed to fetch collections' });
  });

  test('should filter bookmarks by collection in HTML export', async () => {
    // Setup data
    const bookmarks = [
      { id: 'b1', url: 'http://b1.com', title: 'B1', collection_id: 'c1' },
      { id: 'b2', url: 'http://b2.com', title: 'B2', collection_id: 'c2' },
    ];
    const collections = [
      { id: 'c1', name: 'Collection 1' },
      { id: 'c2', name: 'Collection 2' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      const success = (data: any) => ({
        select: () => ({ eq: () => ({ is: () => ({ order: vi.fn().mockResolvedValue({ data, error: null }) }) }) })
      });

      if (table === 'bookmarks') return success(bookmarks);
      if (table === 'collections') return success(collections);
      if (table === 'tags') return success([]);
      return { select: vi.fn() };
    });

    const req = new NextRequest('http://localhost/api/bookmarks/export?format=html');
    const res = await GET(req);
    const html = await res.text();

    const c1Index = html.indexOf('Collection 1');
    const c2Index = html.indexOf('Collection 2');

    // Safety check just in case indices are -1
    expect(c1Index).toBeGreaterThan(-1);
    expect(c2Index).toBeGreaterThan(c1Index);

    const c1Content = html.substring(c1Index, c2Index);

    // Should contain B1
    expect(c1Content).toContain('http://b1.com');
    // Should NOT contain B2
    expect(c1Content).not.toContain('http://b2.com');
  });

  test('should validly escape favicon_url', async () => {
    const bookmarks = [
      {
        id: 'b1',
        url: 'http://b1.com',
        title: 'B1',
        favicon_url: '"> <script>alert(1)</script>' // Malicious payload
      },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      const success = (data: any) => ({
        select: () => ({ eq: () => ({ is: () => ({ order: vi.fn().mockResolvedValue({ data, error: null }) }) }) })
      });

      if (table === 'bookmarks') return success(bookmarks);
      if (table === 'collections') return success([]);
      if (table === 'tags') return success([]);
      return { select: vi.fn() };
    });

    const req = new NextRequest('http://localhost/api/bookmarks/export?format=html');
    const res = await GET(req);
    const html = await res.text();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&quot;&gt; &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('should include created_at in collections query and use it in HTML export', async () => {
    const specificDate = '2024-01-15T10:30:00.000Z';
    const specificTimestamp = Math.floor(new Date(specificDate).getTime() / 1000);

    const bookmarks = [
      { id: 'b1', url: 'http://b1.com', title: 'B1', collection_id: 'c1', created_at: '2024-01-16T10:00:00.000Z' },
    ];
    const collections = [
      { id: 'c1', name: 'Test Collection', created_at: specificDate },
    ];

    let collectionsSelectCalled = false;
    let collectionsSelectFields = '';

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return {
          select: () => ({ eq: () => ({ is: () => ({ order: vi.fn().mockResolvedValue({ data: bookmarks, error: null }) }) }) })
        };
      }
      if (table === 'collections') {
        return {
          select: (fields: string) => {
            collectionsSelectCalled = true;
            collectionsSelectFields = fields;
            return { eq: () => ({ is: () => ({ order: vi.fn().mockResolvedValue({ data: collections, error: null }) }) }) };
          }
        };
      }
      if (table === 'tags') {
        return {
          select: () => ({ eq: () => ({ is: () => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) })
        };
      }
      return { select: vi.fn() };
    });

    const req = new NextRequest('http://localhost/api/bookmarks/export?format=html');
    const res = await GET(req);
    const html = await res.text();

    // Verify that collections select was called with created_at field
    expect(collectionsSelectCalled).toBe(true);
    expect(collectionsSelectFields).toContain('created_at');

    // Verify that the HTML uses the actual created_at timestamp, not now
    expect(html).toContain(`ADD_DATE="${specificTimestamp}"`);
  });
});
