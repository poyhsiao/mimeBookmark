import { describe, expect, test, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/stripe/server', () => ({
  createCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { POST } from '../route';
import { createCustomerPortalSession } from '@/lib/stripe/server';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

const mockUser = { id: 'test-user-id', email: 'test@example.com' };

describe('POST /api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase as any);
  });

  test('returns 401 for unauthenticated user', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: null } } as any);

    const request = new NextRequest(new URL('/api/stripe/portal', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  test('returns 400 when no Stripe customer found', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: mockUser } } as any);
    vi.mocked(mockSupabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const request = new NextRequest(new URL('/api/stripe/portal', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('No Stripe customer found');
  });

  test('creates portal session for valid customer', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: mockUser } } as any);
    vi.mocked(mockSupabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { stripe_customer_id: 'cus_123' },
        error: null,
      }),
    });
    vi.mocked(createCustomerPortalSession).mockResolvedValue({
      url: 'https://billing.stripe.com/xxx',
    } as any);

    const request = new NextRequest(new URL('/api/stripe/portal', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.url).toBe('https://billing.stripe.com/xxx');
  });
});
