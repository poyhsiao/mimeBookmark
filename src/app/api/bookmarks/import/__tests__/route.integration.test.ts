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

describe('Import Route - Integration Tests', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ user: mockUser } as any);
  });

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

  test('Complete import workflow: tags + new bookmarks + overwrites', async () => {
    const existingBookmarks = [
      { id: 'existing-1', url: 'https://old1.com' },
      { id: 'existing-2', url: 'https://old2.com' },
    ];

    const existingTags = [
      { id: 'tag-work', name: 'work' },
    ];

    let bookmarkTagDeletes: any[] = [];
    let bookmarkTagUpserts: any[] = [];
    let bookmarkInserts: any[] = [];
    let bookmarkUpdates: any[] = [];
    let tagInserts: any[] = [];

    const mockFrom = vi.fn();
    mockSupabase.from = mockFrom;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { bookmarks_count: 5, bookmarks_limit: 100 },
            error: null,
          }),
        };
      }

      if (table === 'tags') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: existingTags }),
              }),
            }),
          }),
          insert: vi.fn((tags) => {
            tagInserts.push(...tags);
            const newTags = tags.map((t: any, i: number) => ({
              id: `tag-new-${i}`,
              name: t.name,
            }));
            return {
              select: vi.fn().mockResolvedValue({
                data: newTags,
                error: null,
              }),
            };
          }),
        };
      }

      if (table === 'bookmarks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: existingBookmarks }),
          }),
          update: vi.fn((data) => {
            bookmarkUpdates.push(data);
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
          insert: vi.fn((data) => {
            bookmarkInserts.push(data);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: `bookmark-new-${bookmarkInserts.length}` },
                  error: null,
                }),
              }),
            };
          }),
        };
      }

      if (table === 'bookmark_tags') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn((field: string, value: string) => {
              bookmarkTagDeletes.push({ field, value });
              return Promise.resolve({ data: null, error: null });
            }),
          }),
          upsert: vi.fn((links) => {
            bookmarkTagUpserts.push(...links);
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }

      return {};
    });

    const importData = {
      tags: [
        { name: 'work' },        // Existing
        { name: 'personal' },    // New
        { name: 'urgent' },      // New
        { name: null },          // Invalid - should be filtered
        { name: 123 },           // Invalid - should be filtered
      ],
      bookmarks: [
        // Overwrite existing
        {
          url: 'https://old1.com',
          title: 'Updated Old 1',
          ogTitle: 'OG Updated Old 1',
          ogDescription: 'OG Desc for Old 1',
          tags: ['work', 'urgent'],
        },
        {
          url: 'https://old2.com',
          title: 'Updated Old 2',
          tags: ['personal'],
        },
        // New bookmarks
        {
          url: 'https://new1.com',
          title: 'New Bookmark 1',
          ogTitle: 'OG New 1',
          ogDescription: 'OG Desc New 1',
          tags: ['work', 'personal'],
        },
        {
          url: 'https://new2.com',
          title: 'New Bookmark 2',
          tags: ['urgent'],
        },
      ],
    };

    const req = createJsonRequest(importData, true);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    // Verify results
    expect(json.success).toBe(true);
    expect(json.imported).toBe(4); // 2 updates + 2 new inserts
    expect(json.tagsCreated).toBe(2); // personal, urgent (work already existed)
    expect(json.errors.length).toBe(0);

    // Verify tag creation
    expect(tagInserts.length).toBe(2);
    expect(tagInserts.map((t: any) => t.name)).toEqual(['personal', 'urgent']);

    // Verify bookmark updates
    expect(bookmarkUpdates.length).toBe(2);
    expect(bookmarkUpdates[0].title).toBe('Updated Old 1');
    expect(bookmarkUpdates[0].og_title).toBe('OG Updated Old 1');
    expect(bookmarkUpdates[0].og_description).toBe('OG Desc for Old 1');

    // Verify bookmark inserts
    expect(bookmarkInserts.length).toBe(2);
    expect(bookmarkInserts[0].url).toBe('https://new1.com');
    expect(bookmarkInserts[0].og_title).toBe('OG New 1');
    expect(bookmarkInserts[0].og_description).toBe('OG Desc New 1');
    expect(bookmarkInserts[1].url).toBe('https://new2.com');

    // Verify tag links were deleted for overwrites
    expect(bookmarkTagDeletes.length).toBe(2);
    expect(bookmarkTagDeletes[0].value).toBe('existing-1');
    expect(bookmarkTagDeletes[1].value).toBe('existing-2');

    // Verify tag links were created
    expect(bookmarkTagUpserts.length).toBeGreaterThan(0);
  });

  test('Real-world scenario: Mixed valid and invalid data', async () => {
    const mockFrom = vi.fn();
    mockSupabase.from = mockFrom;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { bookmarks_count: 98, bookmarks_limit: 100 }, // 2 slots left
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
                { id: 'tag-2', name: 'test' },
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
          in: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              data: [{ id: 'existing-1', url: 'https://existing.com' }],
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

    const importData = {
      tags: [
        { name: 'valid' },
        { name: null },          // Invalid
        { name: '' },            // Invalid
        { name: '  ' },          // Invalid (whitespace)
        { name: 'test' },
        { name: 123 as any },    // Invalid
      ],
      bookmarks: [
        // This will be overwritten (doesn't count against quota)
        {
          url: 'https://existing.com',
          title: 'Updated',
          tags: ['valid', null, 123, '  '], // Mixed valid/invalid tags
        },
        // These are new (only 2 slots available)
        { url: 'https://new1.com', title: 'New 1', tags: ['valid'] },
        { url: 'https://new2.com', title: 'New 2', tags: ['test'] },
        { url: 'https://new3.com', title: 'New 3' }, // Should fail (quota)
        { url: 'https://new4.com', title: 'New 4' }, // Should fail (quota)
      ],
    };

    const req = createJsonRequest(importData, true);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    // Should successfully process:
    // - 1 overwrite (doesn't count against quota)
    // - 2 new inserts (at quota limit)
    expect(json.imported).toBe(3);

    // Should create only valid tags
    expect(json.tagsCreated).toBe(2);

    // Should have 2 quota errors
    expect(json.errors.length).toBe(2);
    expect(json.errors.every((e: string) => e.includes('storage limit reached'))).toBe(true);
  });

  test('Error resilience: Continue processing after individual failures', async () => {
    let insertCount = 0;

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
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn(() => {
                insertCount++;
                // Fail on second insert
                if (insertCount === 2) {
                  return Promise.resolve({
                    data: null,
                    error: { message: 'Duplicate key constraint' },
                  });
                }
                return Promise.resolve({
                  data: { id: `bookmark-${insertCount}` },
                  error: null,
                });
              }),
            }),
          }),
        };
      }

      return {};
    });

    const importData = {
      bookmarks: [
        { url: 'https://bookmark1.com', title: 'Bookmark 1' },
        { url: 'https://bookmark2.com', title: 'Bookmark 2' }, // This will fail
        { url: 'https://bookmark3.com', title: 'Bookmark 3' },
        { url: 'https://bookmark4.com', title: 'Bookmark 4' },
      ],
    };

    const req = createJsonRequest(importData);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    // Should import 3 out of 4 (one failed)
    expect(json.imported).toBe(3);

    // Should have 1 error
    expect(json.errors.length).toBe(1);
    expect(json.errors[0]).toContain('Failed to import');
    expect(json.errors[0]).toContain('bookmark2.com');
  });
});
