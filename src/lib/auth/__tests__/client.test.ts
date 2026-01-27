import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables before imports
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
};

vi.mocked(process.env).NEXT_PUBLIC_SUPABASE_URL = mockEnv.NEXT_PUBLIC_SUPABASE_URL;
vi.mocked(process.env).NEXT_PUBLIC_SUPABASE_ANON_KEY = mockEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
vi.mocked(process.env).NEXT_PUBLIC_APP_URL = mockEnv.NEXT_PUBLIC_APP_URL;

// Mock Supabase SSR client
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      signInWithOAuth: mockSignInWithOAuth,
      signInWithOtp: mockSignInWithOtp,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
    },
  })),
}));

// Import after mocking
const { signUp, signIn, signOut, signInWithOAuth, signInWithMagicLink, resetPassword, updatePassword } = await import('../client');

describe('Auth Client Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    test('should successfully sign up a new user', async () => {
      const mockUser = { id: 'new-user-id', email: 'test@example.com' };
      mockSignUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      const result = await signUp({
        email: 'test@example.com',
        password: 'securepassword123',
        fullName: 'Test User',
      });

      expect(result.error).toBeNull();
      expect(result.data?.user).toEqual(mockUser);
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'securepassword123',
        options: {
          data: {
            full_name: 'Test User',
          },
        },
      });
    });

    test('should return error when sign up fails', async () => {
      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });

      const result = await signUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.error).toBe('User already registered');
      expect(result.data).toBeNull();
    });

    test('should handle sign up without full name', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-id' }, session: null },
        error: null,
      });

      const result = await signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: undefined,
          },
        },
      });
    });
  });

  describe('signIn', () => {
    test('should successfully sign in a user', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' };
      const mockSession = { access_token: 'token123', refresh_token: 'refresh123' };
      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data?.user).toEqual(mockUser);
      expect(result.data?.session).toEqual(mockSession);
    });

    test('should return error for invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const result = await signIn({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      });

      expect(result.error).toBe('Invalid login credentials');
      expect(result.data).toBeNull();
    });
  });

  describe('signOut', () => {
    test('should successfully sign out user', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const result = await signOut();

      expect(result.error).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });

    test('should return error when sign out fails', async () => {
      mockSignOut.mockResolvedValue({ error: { message: 'Sign out failed' } });

      const result = await signOut();

      expect(result.error).toBe('Sign out failed');
    });
  });

  describe('signInWithOAuth', () => {
    test('should initiate Google OAuth flow', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/oauth/authorize' },
        error: null,
      });

      const result = await signInWithOAuth('google');

      expect(result.error).toBeNull();
      expect(result.url).toBe('https://accounts.google.com/oauth/authorize');
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${mockEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
    });

    test('should initiate GitHub OAuth flow', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://github.com/login/oauth/authorize' },
        error: null,
      });

      const result = await signInWithOAuth('github');

      expect(result.error).toBeNull();
      expect(result.url).toBe('https://github.com/login/oauth/authorize');
    });

    test('should return error when OAuth fails', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: null,
        error: { message: 'OAuth provider error' },
      });

      const result = await signInWithOAuth('google');

      expect(result.error).toBe('OAuth provider error');
      expect(result.url).toBeNull();
    });
  });

  describe('signInWithMagicLink', () => {
    test('should send magic link successfully', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const result = await signInWithMagicLink('test@example.com');

      expect(result.error).toBeNull();
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: `${mockEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });
    });

    test('should return error when sending magic link fails', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: { message: 'Failed to send email' } });

      const result = await signInWithMagicLink('test@example.com');

      expect(result.error).toBe('Failed to send email');
    });
  });

  describe('resetPassword', () => {
    test('should send password reset email', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const result = await resetPassword('test@example.com');

      expect(result.error).toBeNull();
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: `${mockEnv.NEXT_PUBLIC_APP_URL}/reset-password`,
      });
    });

    test('should return error when reset fails', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Email not found' } });

      const result = await resetPassword('unknown@example.com');

      expect(result.error).toBe('Email not found');
    });
  });

  describe('updatePassword', () => {
    test('should update user password', async () => {
      mockUpdateUser.mockResolvedValue({ error: null });

      const result = await updatePassword('newsecurepassword456');

      expect(result.error).toBeNull();
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'newsecurepassword456',
      });
    });

    test('should return error when update fails', async () => {
      mockUpdateUser.mockResolvedValue({ error: { message: 'Weak password' } });

      const result = await updatePassword('123');

      expect(result.error).toBe('Weak password');
    });
  });
});
