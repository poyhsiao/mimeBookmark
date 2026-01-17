import { describe, expect, test, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/stripe/webhook', () => ({
  constructWebhookEvent: vi.fn(),
  handleWebhookEvent: vi.fn(),
}));

import { constructWebhookEvent, handleWebhookEvent } from '@/lib/stripe/webhook';

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns 400 when stripe-signature header is missing', async () => {
    const request = new NextRequest(new URL('/api/stripe/webhook', 'http://localhost'), {
      method: 'POST',
      body: '{}',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing stripe-signature header');
  });

  test('returns 500 when webhook handling fails', async () => {
    vi.mocked(constructWebhookEvent).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const request = new NextRequest(new URL('/api/stripe/webhook', 'http://localhost'), {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'test-signature' },
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Webhook handler failed');
  });

  test('returns success when webhook is handled correctly', async () => {
    vi.mocked(constructWebhookEvent).mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {} },
    } as any);
    vi.mocked(handleWebhookEvent).mockResolvedValue({
      success: true,
      message: 'Checkout session handled',
    });

    const request = new NextRequest(new URL('/api/stripe/webhook', 'http://localhost'), {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'test-signature' },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
