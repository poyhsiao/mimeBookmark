import { describe, expect, test, vi, beforeEach } from 'vitest';
import { POST } from '../route';
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

describe('Import Route - Bug Fixes Validation', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ user: mockUser } as any);
  });

  // Helper to create JSON import request
  function createJsonRequest(data: any, overwrite = false) {
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    formData.append('file', blob, 'bookmarks.json');
    if (overwrite) {
      formData.append('overwrite', 'true');
    }

    return new NextRequest('http://localhost/api/bookmarks/import', {
      method: 'POST',
      body: formData,
    });
  }

  describe('Fix 1: Tag Name Defensive Validation', () => {
    beforeEach(() => {
      const mockFrom = vi.fn();
      mockSupabase.from = mockFrom;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { bookmarks_count: 0, bookmarks_limit: 100 },
              error: null,
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: 'tag-1', name: 'valid' },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [] }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'bookmark-1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'bookmark_tags') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });
    });

    test('should handle non-string tag names without crashing', async () => {
      const data = {
        tags: [
          { name: 'valid' },
          { name: null },
          { name: 123 },
          { name: '' },
          { name: '  ' }, // whitespace only
          { name: undefined },
        ],
        bookmarks: [
          {
            url: 'https://example.com',
            title: 'Example',
            tags: ['valid'],
          },
        ],
      };

      const req = createJsonRequest(data);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.tagsCreated).toBe(1); // Only 'valid' should be created
      expect(json.imported).toBe(1);
    });

    test('should handle non-string bookmark tag references', async () => {
      const data = {
        tags: [{ name: 'work' }],
        bookmarks: [
          {
            url: 'https://example.com',
            title: 'Example',
            tags: ['work', null, 123, '', '  '], // Mixed types
          },
        ],
      };

      const req = createJsonRequest(data);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Should not crash and should only link 'work' tag
    });
  });

  describe('Fix 2: Quota Check Logic', () => {
    test('should use separate counter for new inserts vs updates', async () => {
      const existingBookmarkId = 'existing-1';

      const mockFrom = vi.fn();
      mockSupabase.from = mockFrom;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { bookmarks_count: 95, bookmarks_limit: 100 }, // 5 slots left
              error: null,
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  { id: existingBookmarkId, url: 'https://existing.com' },
                ],
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-id' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'bookmark_tags') {
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const data = {
        bookmarks: [
          // 1 existing (should update, not count against quota)
          { url: 'https://existing.com', title: 'Existing' },
          // 5 new (should all succeed - exactly at limit)
          { url: 'https://new1.com', title: 'New 1' },
          { url: 'https://new2.com', title: 'New 2' },
          { url: 'https://new3.com', title: 'New 3' },
          { url: 'https://new4.com', title: 'New 4' },
          { url: 'https://new5.com', title: 'New 5' },
          // 1 more (should fail - over limit)
          { url: 'https://new6.com', title: 'New 6' },
        ],
      };

      const req = createJsonRequest(data, true); // overwrite=true
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should import 6 total (1 update + 5 new inserts)
      expect(json.imported).toBe(6);
      // Should have 1 error for the 7th bookmark
      expect(json.errors.length).toBe(1);
      expect(json.errors[0]).toContain('storage limit reached');
    });

    test('should not count overwrites against quota', async () => {
      const mockFrom = vi.fn();
      mockSupabase.from = mockFrom;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { bookmarks_count: 100, bookmarks_limit: 100 }, // At limit
              error: null,
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  { id: 'existing-1', url: 'https://existing1.com' },
                  { id: 'existing-2', url: 'https://existing2.com' },
                ],
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === 'bookmark_tags') {
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const data = {
        bookmarks: [
          { url: 'https://existing1.com', title: 'Update 1' },
          { url: 'https://existing2.com', title: 'Update 2' },
        ],
      };

      const req = createJsonRequest(data, true);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should successfully update both (not blocked by quota)
      expect(json.imported).toBe(2);
      expect(json.errors.length).toBe(0);
    });
  });

  describe('Fix 3: Overwrite Mode Error Handling and Tag Application', () => {
    test('should report update errors instead of silently ignoring them', async () => {
      const mockFrom = vi.fn();
      mockSupabase.from = mockFrom;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { bookmarks_count: 0, bookmarks_limit: 100 },
              error: null,
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [{ id: 'existing-1', url: 'https://existing.com' }],
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database constraint violation' },
              }),
            }),
          };
        }
        return {};
      });

      const data = {
        bookmarks: [{ url: 'https://existing.com', title: 'Updated' }],
      };

      const req = createJsonRequest(data, true);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should have error recorded
      expect(json.errors.length).toBe(1);
      expect(json.errors[0]).toContain('Failed to update');
      expect(json.errors[0]).toContain('Database constraint violation');
      // Should not increment imported count
      expect(json.imported).toBe(0);
    });

    test('should apply tags when overwriting bookmarks', async () => {
      const mockDeleteFn = vi.fn().mockReturnThis();
      const mockDeleteEqFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null });

      const mockFrom = vi.fn();
      mockSupabase.from = mockFrom;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { bookmarks_count: 0, bookmarks_limit: 100 },
              error: null,
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'tag-work', name: 'work' },
                      { id: 'tag-important', name: 'important' },
                    ],
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [{ id: 'existing-1', url: 'https://example.com' }],
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === 'bookmark_tags') {
          return {
            delete: mockDeleteFn,
            eq: mockDeleteEqFn,
            upsert: mockUpsertFn,
          };
        }
        return {};
      });

      mockDeleteFn.mockReturnValue({
        eq: mockDeleteEqFn,
      });

      const data = {
        tags: [{ name: 'work' }, { name: 'important' }],
        bookmarks: [
          {
            url: 'https://example.com',
            title: 'Example',
            tags: ['work', 'important'],
          },
        ],
      };

      const req = createJsonRequest(data, true);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.imported).toBe(1);

      // Verify that old tags were deleted
      expect(mockDeleteFn).toHaveBeenCalled();
      expect(mockDeleteEqFn).toHaveBeenCalledWith('bookmark_id', 'existing-1');

      // Verify that new tags were inserted
      expect(mockUpsertFn).toHaveBeenCalled();
      const upsertCall = mockUpsertFn.mock.calls[0][0];
      expect(upsertCall).toEqual([
        { bookmark_id: 'existing-1', tag_id: 'tag-work' },
        { bookmark_id: 'existing-1', tag_id: 'tag-important' },
      ]);
    });
  });

  describe('Fix 4: Open Graph Metadata Persistence', () => {
    test('should persist og_title and og_description on new bookmark insert', async () => {
      const mockInsertFn = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-bookmark' },
            error: null,
          }),
        }),
      });

      const mockFrom = vi.fn();
      mockSupabase.from = mockFrom;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { bookmarks_count: 0, bookmarks_limit: 100 },
              error: null,
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [] }), // No existing
            }),
            insert: mockInsertFn,
          };
        }
        return {};
      });

      const data = {
        bookmarks: [
          {
            url: 'https://example.com',
            title: 'Example Site',
            ogTitle: 'OG Title for Example',
            ogDescription: 'This is the OG description',
            description: 'Regular description',
          },
        ],
      };

      const req = createJsonRequest(data);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.imported).toBe(1);

      // Verify insert was called with OG fields
      expect(mockInsertFn).toHaveBeenCalled();
      const insertPayload = mockInsertFn.mock.calls[0][0];

      expect(insertPayload.og_title).toBe('OG Title for Example');
      expect(insertPayload.og_description).toBe('This is the OG description');
      expect(insertPayload.title).toBe('Example Site');
      expect(insertPayload.description).toBe('Regular description');
    });

    test('should handle missing OG fields gracefully', async () => {
      const mockInsertFn = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-bookmark' },
            error: null,
          }),
        }),
      });

      const mockFrom = vi.fn();
      mockSupabase.from = mockFrom;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { bookmarks_count: 0, bookmarks_limit: 100 },
              error: null,
            }),
          };
        }
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [] }),
            }),
            insert: mockInsertFn,
          };
        }
        return {};
      });

      const data = {
        bookmarks: [
          {
            url: 'https://example.com',
            title: 'Example Site',
            // No OG fields
          },
        ],
      };

      const req = createJsonRequest(data);
      const res = await POST(req);

      expect(res.status).toBe(200);

      // Verify insert was called with null OG fields
      const insertPayload = mockInsertFn.mock.calls[0][0];
      expect(insertPayload.og_title).toBe(null);
      expect(insertPayload.og_description).toBe(null);
    });
  });
});
