
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

describe('Import Route', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ user: mockUser } as any);

    // Default Supabase mocks
    const mockFrom = vi.fn();
    mockSupabase.from = mockFrom;

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    // Default implementation for tables
    mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
            return {
                ...mockChain,
                // Profile check success
                single: vi.fn().mockResolvedValue({ data: { bookmarks_count: 0, bookmarks_limit: 100 }, error: null })
            };
        }
        if (table === 'bookmarks') {
             return {
                ...mockChain,
                 // For duplicates check: return null (not found)
                 single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
                 // For insert: return new bookmark chain
                 insert: vi.fn().mockReturnValue({
                     select: vi.fn().mockReturnValue({
                         single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null })
                     })
                 })
            };
        }
        if (table === 'tags') {
            return {
                ...mockChain,
                single: vi.fn().mockResolvedValue({ data: null }), // tag not found
                insert: vi.fn().mockReturnValue({
                     select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { id: 'tag-id' }, error: null })
                     })
                })
            };
        }
        // Fallback for other tables
        return {
            ...mockChain,
            select: vi.fn().mockReturnValue({
                 eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                           single: vi.fn().mockResolvedValue({ data: null })
                      })
                 })
            })
        };
    });
  });

  function createHtmlRequest(htmlContent: string) {
    const formData = new FormData();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    formData.append('file', blob, 'bookmarks.html');

    return new NextRequest('http://localhost/api/bookmarks/import', {
      method: 'POST',
      body: formData,
    });
  }

  test('should handle invalid timestamp by falling back safely', async () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL><p>
        <DT><A HREF="http://example.com" ADD_DATE="invalid-date">Example</A>
      </DL><p>
    `;

    const req = createHtmlRequest(html);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(1);
  });

  test('should handle attributes in different order', async () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL><p>
        <DT><A ADD_DATE="1600000000" HREF="http://mixed-attributes.com" ICON="http://icon.com">Example</A>
      </DL><p>
    `;

    const req = createHtmlRequest(html);
    const res = await POST(req);
    const json = await res.json();

    expect(json.imported).toBe(1);
  });
});
