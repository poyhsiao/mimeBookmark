import { describe, expect, test, vi, beforeEach } from 'vitest';
import { loadStripe } from '@stripe/stripe-js';
import { getStripePublishableKey, isStripeEnabled } from '../client';

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(),
}));

describe('getStripePublishableKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  });

  test('returns key when environment variable is set', () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_xxx';
    expect(getStripePublishableKey()).toBe('pk_test_xxx');
  });

  test('throws error when environment variable is not set', () => {
    expect(() => getStripePublishableKey()).toThrow(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured'
    );
  });
});

describe('isStripeEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  });

  test('returns true when key is configured', () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_xxx';
    expect(isStripeEnabled()).toBe(true);
  });

  test('returns false when key is not configured', () => {
    expect(isStripeEnabled()).toBe(false);
  });
});
