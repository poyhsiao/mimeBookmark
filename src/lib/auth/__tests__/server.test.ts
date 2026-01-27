import { describe, expect, test, vi, beforeEach } from 'vitest';

// Mock environment - E2E mode off for all tests
vi.stubEnv('E2E_USE_MOCK', 'false');
vi.stubEnv('NODE_ENV', 'development');

// Mock cookies store - must include both get and getAll methods
const mockCookieStore = {
  get: vi.fn(),
  getAll: vi.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabase: any = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => mockSupabase),
}));

const { getCurrentUser, getSession } = await import('../server');

describe('Auth Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.getAll.mockReturnValue([]);
    mockCookieStore.get.mockReturnValue(undefined);
    vi.stubEnv('E2E_USE_MOCK', 'false');
  });

  describe('getCurrentUser', () => {
    test('returns user from Supabase when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
      });

      const result = await getCurrentUser();

      expect(result.error).toBeNull();
      expect(result.user).toEqual(mockUser);
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    });

    test('returns error when user not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const result = await getCurrentUser();

      expect(result.error).toBe('No user found');
      expect(result.user).toBeNull();
    });

    test('returns error message from Supabase', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth token expired' },
      });

      const result = await getCurrentUser();

      expect(result.error).toBe('Auth token expired');
      expect(result.user).toBeNull();
    });

    test('returns null error on successful auth', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null,
      });

      const result = await getCurrentUser();

      expect(result.error).toBeNull();
      expect(result.user).not.toBeNull();
    });
  });

  describe('getSession', () => {
    test('returns session from Supabase', async () => {
      const mockSession = {
        access_token: 'token-123',
        user: { id: 'user-123', email: 'test@example.com' },
      };
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      });

      const result = await getSession();

      expect(result.error).toBeNull();
      expect(result.session).toEqual(mockSession);
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    test('returns null session when none exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const result = await getSession();

      expect(result.session).toBeNull();
    });

    test('returns error message on session failure', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session retrieval failed' },
      });

      const result = await getSession();

      expect(result.error).toBe('Session retrieval failed');
      expect(result.session).toBeNull();
    });

    test('returns null error on successful session retrieval', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      const result = await getSession();

      expect(result.error).toBeNull();
      expect(result.session).not.toBeNull();
    });
  });
});
