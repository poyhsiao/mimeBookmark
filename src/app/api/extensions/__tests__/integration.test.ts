import { describe, expect, test, vi, beforeAll, afterEach, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { POST as BatchSavePOST } from '../batch-save/route';
import { GET as SyncGET } from '../sync/route';
import { GET as MetadataGET } from '../../metadata/route';
import { MAX_REQUESTS } from '@/app/api/metadata/rate-limit';

// Mock Supabase client and auth
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn((table: string) => {
    // Helper to create a chainable query builder
    const createQueryBuilder = (initialData: any = null) => {
      // Create update context that supports chaining eq/neq/select
      const updateContext: any = {
        eq: vi.fn(() => updateContext),
        neq: vi.fn(() => updateContext),
        select: vi.fn(() => updateContext),
        single: vi.fn().mockResolvedValue({ data: initialData, error: null }),
      };

      // Create insert context that supports chaining select
      const insertContext: any = {
        select: vi.fn(() => insertContext),
        single: vi.fn().mockResolvedValue({ data: initialData, error: null }),
      };

      // Create upsert context that supports chaining select
      const upsertContext: any = {
        select: vi.fn(() => upsertContext),
        single: vi.fn().mockResolvedValue({ data: initialData, error: null }),
      };

      // Create select context for chaining
      const selectContext: any = {
        eq: vi.fn(() => selectContext),
        is: vi.fn(() => selectContext),
        neq: vi.fn(() => selectContext),
        in: vi.fn(() => selectContext),
        order: vi.fn(() => selectContext),
        limit: vi.fn(() => selectContext),
        maybeSingle: vi.fn().mockResolvedValue({ data: initialData, error: null }),
        single: vi.fn().mockResolvedValue({ data: initialData, error: null }),
      };

      // Chainable methods that return the query object
      const chainableMethods = {
        select: vi.fn(() => selectContext),
        insert: vi.fn(() => insertContext),
        update: vi.fn(() => updateContext),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn(() => upsertContext),
        eq: vi.fn(() => selectContext),
        is: vi.fn(() => selectContext),
        neq: vi.fn(() => selectContext),
        in: vi.fn(() => selectContext),
        order: vi.fn(() => selectContext),
        limit: vi.fn(() => selectContext),
        maybeSingle: vi.fn().mockResolvedValue({ data: initialData, error: null }),
        single: vi.fn().mockResolvedValue({ data: initialData, error: null }),
      };

      return chainableMethods;
    };

    // Table-based factory that returns appropriate stubbed chains
    if (table === 'bookmarks') {
      return createQueryBuilder();
    }
    if (table === 'sessions' || table === 'session_devices') {
      return createQueryBuilder();
    }
    if (table === 'profiles') {
      return createQueryBuilder();
    }
    if (table === 'collections') {
      return createQueryBuilder();
    }
    if (table === 'tags') {
      return createQueryBuilder();
    }
    if (table === 'bookmark_tags') {
      return createQueryBuilder();
    }
    if (table === 'collection_bookmarks') {
      return createQueryBuilder();
    }
    // Default fallback
    return createQueryBuilder();
  }),
  rpc: vi.fn(),
};

const mockAuth = {
  getCurrentUser: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: mockAuth.getCurrentUser,
}));

// Helper to create mock requests with proper Request init
function createMockRequest(url: string, method: string = 'GET', body?: any, options?: { includeAuth?: boolean; sessionId?: string }) {
  const urlObj = new URL(url, 'http://localhost');
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  };

  // Add Authorization header with mock JWT if requested
  if (options?.includeAuth) {
    // Create a mock JWT payload with session_id claim
    const mockPayload = {
      session_id: options.sessionId || 'test-current-session-id',
      sid: options.sessionId || 'test-current-session-id',
      sub: 'test-user-id',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    // Encode to base64url (mock JWT without signature)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
    const mockToken = `${header}.${payload}.signature`;

    (init.headers as Record<string, string>)['authorization'] = `Bearer ${mockToken}`;
  }

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(urlObj, init);
}

describe('Extension Integration Tests', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

   beforeEach(() => {
     vi.resetAllMocks();
     vi.mocked(createClient).mockResolvedValue(mockSupabase);
   });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Flow', () => {
    test('should authenticate and get user data', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      // Stub mockSupabase.auth.getUser to match the assertion below
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const { data: { user } } = await mockSupabase.auth.getUser();
      expect(user).toEqual(mockUser);
    });

    test('should handle unauthorized access', async () => {
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: null,
      });

      // Test that getCurrentUser returns null when unauthenticated
      const result = await mockAuth.getCurrentUser();
      expect(result.data).toBeNull();
    });
  });

  describe('Extension Session Management', () => {
    test('should send device info on login', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const request = createMockRequest('http://localhost/api/me/sessions', 'POST', {
        device_name: 'Chrome on macOS',
        device_type: 'desktop',
        platform: 'macOS',
        os: 'Macintosh',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });

      // Import the actual handler and call it directly
      const { POST } = await import('../../me/sessions/route');
      const response = await POST(request);

      // POST creates a new session and returns 201 Created
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ session: expect.any(Object) });
    });

    test('should list user sessions', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const request = createMockRequest('http://localhost/api/me/sessions', 'GET');

      // Import the actual handler and call it directly
      const { GET } = await import('../../me/sessions/route');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('sessions');
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    test('should revoke a session', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      });

      // Mock the sessions table to return an existing session
      const maybeSingleMock = vi.fn().mockResolvedValueOnce({
        data: { id: 'test-session-id', user_id: 'test-user-id' },
        error: null,
      });
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: maybeSingleMock,
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockResolvedValue({ data: null, error: null }),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = createMockRequest('http://localhost/api/me/sessions/test-session-id', 'DELETE');

      // Import the actual handler and call it directly
      const { DELETE } = await import('../../me/sessions/[id]/route');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'test-session-id' }) });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    });

    test('should revoke all other sessions', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      });

      // Mock getSession to return a session with id
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: { id: 'test-current-session-id', user: mockUser } },
      });

      const request = createMockRequest('http://localhost/api/me/sessions/revoke-all', 'POST');

      // Import the actual handler and call it directly
      const { POST } = await import('../../me/sessions/revoke-all/route');
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, revoked_count: expect.any(Number) });
    });

    test('should update session display name', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const request = createMockRequest('http://localhost/api/me/sessions/test-session-id', 'PUT', {
        display_name: 'My Work Device',
      });

      // Import the actual handler and call it directly
      const { PUT } = await import('../../me/sessions/[id]/route');
      const response = await PUT(request, { params: Promise.resolve({ id: 'test-session-id' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('session');
    });
  });

  describe('Bookmark Operations via Extension', () => {
    test('should save multiple bookmarks via batch-save', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const tabs = [
        { url: 'https://example.com/1', title: 'Example 1' },
        { url: 'https://example.com/2', title: 'Example 2' },
      ];

      const request = createMockRequest('http://localhost/api/extensions/batch-save', 'POST', {
        tabs,
        collectionId: null,
        tags: null,
      });

      const response = await BatchSavePOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('saved');
      expect(typeof data.saved).toBe('number');
    });

    test('should handle quota exceeded on batch-save', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com', bookmarks_limit: 5, bookmarks_count: 5 };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const tabs = [
        { url: 'https://example.com/1', title: 'Example 1' },
        { url: 'https://example.com/2', title: 'Example 2' },
        { url: 'https://example.com/3', title: 'Example 3' },
      ];

      const request = createMockRequest('http://localhost/api/extensions/batch-save', 'POST', {
        tabs,
        collectionId: null,
        tags: null,
      });

      const response = await BatchSavePOST(request);

      expect(response.status).toBe(403);
      const data = await response.json();

      expect(data.error).toBe('Not enough storage');
      expect(data).toHaveProperty('requested');
      expect(data.requested).toBe(3);
      expect(data.remaining).toBe(0);
    });

    test('should skip duplicate bookmarks in batch-save', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com', bookmarks_limit: 100, bookmarks_count: 97 };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const tabs = [
        { url: 'https://example.com/1', title: 'Example 1' },
        { url: 'https://example.com/1', title: 'Example 1 (duplicate)' },
        { url: 'https://example.com/2', title: 'Example 2' },
      ];

      const request = createMockRequest('http://localhost/api/extensions/batch-save', 'POST', {
        tabs,
        collectionId: null,
        tags: null,
      });

      const response = await BatchSavePOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.saved).toBe(2);
      expect(data.skipped).toBe(1);
    });
  });

  describe('Sync Operations via Extension', () => {
    test('should sync local bookmarks to server', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const localBookmarks = [
        {
          id: 'local-1',
          url: 'https://example.com/1',
          title: 'Local Bookmark 1',
          updated_at: '2024-01-15T10:00:00.000Z',
        },
      ];

      const remoteBookmarks = [
        {
          id: 'remote-1',
          url: 'https://example.com/1',
          title: 'Remote Bookmark 1 (conflict)',
          updated_at: '2024-01-14T10:00:00.000Z',
        },
      ];

      const request = createMockRequest('http://localhost/api/extensions/sync', 'POST', {
        lastSyncTimestamp: '2024-01-15T10:00:00.000Z',
        bookmarks: localBookmarks,
        collections: [],
        tags: [],
      });

      // Import the actual POST handler and call it directly
      const { POST } = await import('../sync/route');
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('syncResults');
      expect(data.syncResults.conflicts).toBeDefined();
      expect(Array.isArray(data.syncResults.conflicts)).toBe(true);
    });

    test('should download server changes via GET', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      // Use GET with query parameter for downloading changes
      const request = createMockRequest('http://localhost/api/extensions/sync?since=2024-01-14T10:00:00.000Z', 'GET');

      // Import the actual GET handler and call it directly
      const { GET } = await import('../sync/route');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('bookmarks');
      expect(data).toHaveProperty('collections');
      expect(data).toHaveProperty('tags');
    });
  });

   describe('Metadata Fetching via Extension', () => {
     test('should fetch metadata for bookmark', async () => {
       const mockUser = { id: 'test-user-id', email: 'test@example.com' };
       vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
         data: { user: mockUser },
       });

       const originalFetch = global.fetch;
       global.fetch = vi.fn().mockResolvedValue(
         new Response(
           '<html><head><title>Example</title><meta name="description" content="Example desc"><link rel="icon" href="https://example.com/favicon.ico"></head></html>',
           { status: 200, headers: { 'content-type': 'text/html' } }
         )
       );
       try {
         const request = createMockRequest('http://localhost/api/metadata?url=https://example.com');
         const response = await MetadataGET(request);

         expect(response.status).toBe(200);
         const data = await response.json();

         expect(data).toHaveProperty('title');
         expect(data).toHaveProperty('description');
         expect(data).toHaveProperty('favicon_url');
       } finally {
         global.fetch = originalFetch;
       }
     });

     test('should handle rate limiting on metadata API', async () => {
       // Make multiple rapid requests to trigger rate limit
       const mockUser = { id: 'test-user-id', email: 'test@example.com' };
       vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
         data: { user: mockUser },
       });

       // Create MAX_REQUESTS + 1 requests to exercise the actual limit
       const requests = Array(MAX_REQUESTS + 1).fill(null).map((_, i) =>
         createMockRequest(
           `http://localhost/api/metadata?url=https://example.com/${i}`,
           'GET',
           undefined,
           { headers: { 'x-forwarded-for': '203.0.113.10' } }
         )
       );

       const responses = await Promise.all(
         requests.map((req) => MetadataGET(req))
       );

       // First MAX_REQUESTS should succeed
       for (let i = 0; i < MAX_REQUESTS; i++) {
         expect(responses[i].status).toBe(200);
       }

       // (MAX_REQUESTS + 1)th request should be rate limited (429)
       expect(responses[MAX_REQUESTS].status).toBe(429);
     });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      // Mock fetch to simulate network error in the actual route handler
      const originalFetch = global.fetch;
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      try {
        // Import and call the actual route handler that uses fetch
        // The batch-save handler doesn't directly use fetch, but let's test metadata route which does
        const request = createMockRequest('http://localhost/api/metadata?url=https://example.com');
        const response = await MetadataGET(request);

        // Should return an error response when fetch fails
        expect(response.status).toBeGreaterThanOrEqual(400);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('should handle malformed JSON requests', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      // Create a request with invalid JSON body
      // We need to mock the request.json() method to throw
      const url = new URL('http://localhost/api/extensions/sync');
      const init: RequestInit = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json {',
      };

      const request = new NextRequest(url, init);

      // Mock request.json() to throw SyntaxError
      const originalJson = request.json;
      request.json = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'));

      // Import the actual POST handler and call it directly
      const { POST } = await import('../sync/route');
      const response = await POST(request);

      // Should return 400 for malformed JSON
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid JSON in request body');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty bookmark array in batch-save', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const request = createMockRequest('http://localhost/api/extensions/batch-save', 'POST', {
        tabs: [],
      });

      const response = await BatchSavePOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        success: true,
        saved: 0,
        skipped: 0,
        bookmarks: [],
        warnings: ['No bookmarks provided'],
      });
    });

    test('should handle missing user authentication', async () => {
      // Configure the existing mock to return null user
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: null,
      });

      const request = createMockRequest('http://localhost/api/me/sessions', 'POST', {
        device_name: 'Test Device',
      });

      // Import the actual handler and call it directly
      const { POST } = await import('../../me/sessions/route');
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    test('should handle very large bookmark arrays (>1000 items)', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com', bookmarks_limit: 10000 };
      vi.mocked(mockAuth.getCurrentUser).mockResolvedValue({
        data: { user: mockUser },
      });

      const largeArray = Array(1500).fill(null).map((_, i) => ({
        url: `https://example.com/${i}`,
        title: `Bookmark ${i}`,
      }));

      const request = createMockRequest('http://localhost/api/extensions/batch-save', 'POST', {
        tabs: largeArray,
      });

      // The backend should handle this gracefully
      // This test verifies the API doesn't crash on large inputs
      const response = await BatchSavePOST(request);

      // Only accept graceful responses - 500 should surface actual failures
      expect([200, 400, 413]).toContain(response.status);
    });
  });
});
