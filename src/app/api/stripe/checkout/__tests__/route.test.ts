import { describe, expect, test, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/stripe/server', () => ({
  createCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/subscription/plans', () => {
  const mockPlans: Record<string, {
    id: string;
    name: string;
    price: number;
    priceId: string | null;
    features: string[];
    limits: Record<string, number>;
  }> = {
    free: { id: 'free', name: 'Free', price: 0, priceId: null, features: [], limits: { bookmarks: 100, collections: 5, tags: 20 } },
    pro: { id: 'pro', name: 'Pro', price: 5, priceId: 'price_pro', features: [], limits: { bookmarks: -1, collections: -1, tags: -1 } },
    team: { id: 'team', name: 'Team', price: 15, priceId: 'price_team', features: [], limits: { bookmarks: -1, collections: -1, tags: -1, teamMembers: 10 } },
  };
  return {
    getPlan: vi.fn((planId: string) => mockPlans[planId]),
    SUBSCRIPTION_PLANS: mockPlans,
  };
});

import { POST } from '../route';
import { createCheckoutSession } from '@/lib/stripe/server';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

const mockUser = { id: 'test-user-id', email: 'test@example.com' };

describe('GET /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase as any);
  });

  test('returns 401 for unauthenticated user', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: null } } as any);

    const request = new NextRequest(new URL('/api/stripe/checkout', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  test('returns 400 for invalid plan ID', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: mockUser } } as any);

    const request = new NextRequest(new URL('/api/stripe/checkout', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({ planId: 'invalid' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid plan ID');
  });

  test('returns 400 for free plan', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: mockUser } } as any);

    const request = new NextRequest(new URL('/api/stripe/checkout', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({ planId: 'free' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Free plan cannot be purchased');
  });

  test('creates checkout session for valid pro plan', async () => {
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: mockUser } } as any);
    vi.mocked(mockSupabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'session_123',
      url: 'https://checkout.stripe.com/xxx',
    } as any);

    const request = new NextRequest(new URL('/api/stripe/checkout', 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessionId).toBe('session_123');
    expect(data.url).toBe('https://checkout.stripe.com/xxx');
  });
});
