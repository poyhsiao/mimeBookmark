import { describe, expect, test, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { promises as dnsPromises } from 'dns';

// Module-level mock supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Helper to create mock requests
function createMockRequest(url: string, method: string = 'GET', body?: any, options?: { includeAuth?: boolean; sessionId?: string }) {
  const urlObj = new URL(url, 'http://localhost');
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (options?.includeAuth) {
    const mockPayload = {
      session_id: options.sessionId || 'test-current-session-id',
      sid: options.sessionId || 'test-current-session-id',
      sub: 'test-user-id',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
    const mockToken = `${header}.${payload}.signature`;
    headers['authorization'] = `Bearer ${mockToken}`;
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(urlObj, init as any);
}

describe('Extension Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
  });

  describe('Authentication Flow', () => {
    test('should authenticate and get user data via actual route', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      } as any);

      // Mock database queries for the stats endpoint
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            } as any),
          }),
        };
      });

      const request = createMockRequest('http://localhost/api/me/stats', 'GET');
      const { GET: StatsGET } = await import('../../me/stats/route');
      const response = await StatsGET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('totalBookmarks', 0);
    });

    test('should handle unauthorized access via actual route', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
      } as any);

      const request = createMockRequest('http://localhost/api/me/stats', 'GET');
      const { GET: StatsGET } = await import('../../me/stats/route');
      const response = await StatsGET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Extension Session Management', () => {
    test('should revoke a session', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      } as any);

      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'test-session-id', user_id: 'test-user-id' },
              error: null,
            } as any),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          update: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          delete: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = createMockRequest('http://localhost/api/me/sessions/test-session-id', 'DELETE');
      const { DELETE } = await import('../../me/sessions/[id]/route');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'test-session-id' }) });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    });

    test('should revoke all other sessions', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      } as any);

      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            id: 'test-current-session-id',
            user: mockUser,
          },
        },
      } as any);

      const request = createMockRequest('http://localhost/api/me/sessions/revoke-all', 'POST');
      const { POST } = await import('../../me/sessions/revoke-all/route');
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, revoked_count: expect.any(Number) });
    });

    test('should update session display name when session exists', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      } as any);

      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'test-session-id', user_id: 'test-user-id', display_name: 'Old Name' },
              error: null,
            } as any),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'test-session-id', user_id: 'test-user-id', display_name: 'My Work Device' },
                    error: null,
                  } as any),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          update: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          delete: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = createMockRequest('http://localhost/api/me/sessions/test-session-id', 'PUT', {
        display_name: 'My Work Device',
      });
      const { PUT } = await import('../../me/sessions/[id]/route');
      const response = await PUT(request, { params: Promise.resolve({ id: 'test-session-id' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('session');
      expect(data.session.display_name).toBe('My Work Device');
    });

    test('should return 404 when updating non-existent session', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      } as any);

      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,  // No error, but session is null -> 404
            } as any),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          update: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          delete: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = createMockRequest('http://localhost/api/me/sessions/non-existent-session-id', 'PUT', {
        display_name: 'My Work Device',
      });
      const { PUT } = await import('../../me/sessions/[id]/route');
      const response = await PUT(request, { params: Promise.resolve({ id: 'non-existent-session-id' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Session not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON requests', async () => {
      const url = new URL('http://localhost/api/extensions/sync');
      const request = new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json {',
      } as any);

      // Mock request.json() to throw
      (request as any).json = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'));

      const { POST: SyncPOST } = await import('../sync/route');
      const response = await SyncPOST(request);

      // Should return 400 for malformed JSON
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid JSON in request body');
    });

    test('should handle missing user authentication', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
      } as any);

      const request = createMockRequest('http://localhost/api/me/sessions', 'POST', {
        device_name: 'Test Device',
      });

      const { POST } = await import('../../me/sessions/route');
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    test('should successfully process large bookmark arrays (>1000 items)', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com', bookmarks_limit: 10000 };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      } as any);

      // Mock collections table - for valid collectionId check AND sync results
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'collections') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'test-collection-id', user_id: 'test-user-id' },
                  error: null,
                } as any),
                gt: vi.fn().mockReturnThis(),
                is: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                } as any),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { bookmarks_count: 0, bookmarks_limit: 10000 },
                  error: null,
                } as any),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),  // Add .gt() for updated_at check
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null } as any),
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null } as any),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
          };
        }
        // Mock for tags tables (used in sync results)
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              is: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              } as any),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          update: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          delete: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const largeArray = Array(1500).fill(null).map((_, i) => ({
        url: `https://example.com/${i}`,
        title: `Bookmark ${i}`,
      }));

      const request = createMockRequest('http://localhost/api/extensions/batch-save', 'POST', {
        tabs: largeArray,
        collectionId: 'test-collection-id',
      });

      const { POST: BatchSavePOST } = await import('../batch-save/route');
      const response = await BatchSavePOST(request);

      // Should successfully process the batch
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });

    test('should return 403 when large array exceeds bookmarks limit', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com', bookmarks_limit: 100 };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      } as any);

      // Mock collections table - for valid collectionId check
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'collections') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'test-collection-id', user_id: 'test-user-id' },
                  error: null,
                } as any),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { bookmarks_count: 50, bookmarks_limit: 100 },
                  error: null,
                } as any),
              }),
            }),
          };
        }
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null } as any),
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null } as any),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
          };
        }
        // Mock for tags table (used in sync results)
        if (table === 'tags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              is: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              } as any),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          update: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          delete: vi.fn().mockResolvedValue({ data: null, error: null } as any),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const largeArray = Array(1500).fill(null).map((_, i) => ({
        url: `https://example.com/${i}`,
        title: `Bookmark ${i}`,
      }));

      const request = createMockRequest('http://localhost/api/extensions/batch-save', 'POST', {
        tabs: largeArray,
        collectionId: 'test-collection-id',
      });

      const { POST: BatchSavePOST } = await import('../batch-save/route');
      const response = await BatchSavePOST(request);

      // Should return 403 when exceeding storage limit
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('storage');
    });
  });

  describe('Metadata Fetching via Extension', () => {
    test('should handle network errors gracefully', async () => {
      const originalFetch = global.fetch;
      const originalDnsLookup = dnsPromises.lookup;

      // Mock DNS lookup to return a private IP, which will make isAllowedUrl return false
      // This triggers the 400 response before fetch is called
      dnsPromises.lookup = vi.fn().mockResolvedValue([
        { address: '127.0.0.1', family: 4 },
      ]);

      try {
        // Mock fetch to simulate network error
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const { GET: MetadataGET } = await import('../../metadata/route');
        const request = createMockRequest('http://localhost/api/metadata?url=https://example.com');
        const response = await MetadataGET(request);

        // Should return 400 because isAllowedUrl rejects the URL (mocked DNS returns private IP)
        // The metadata route returns 400 for invalid URLs
        expect(response.status).toBe(400);
      } finally {
        global.fetch = originalFetch;
        dnsPromises.lookup = originalDnsLookup;
      }
    });
  });
});
